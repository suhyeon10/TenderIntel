#!/usr/bin/env node

/**
 * GitHub Actions에서 실행되는 스크립트
 * 오늘의 Git 커밋 로그를 수집하여 Notion 페이지에 업데이트
 */

const { Client } = require('@notionhq/client');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 환경 변수 확인
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_PARENT_PAGE_ID = process.env.NOTION_PARENT_PAGE_ID; // 작업 일지가 저장될 부모 페이지 ID

if (!NOTION_TOKEN) {
  console.error('❌ NOTION_TOKEN 환경 변수가 설정되지 않았습니다.');
  console.error('   GitHub Secrets에서 NOTION_TOKEN을 설정하세요.');
  process.exit(1);
}

if (!NOTION_PARENT_PAGE_ID) {
  console.error('❌ NOTION_PARENT_PAGE_ID 환경 변수가 설정되지 않았습니다.');
  console.error('   GitHub Secrets에서 NOTION_PARENT_PAGE_ID를 설정하세요.');
  process.exit(1);
}

// 페이지 ID 형식 검증 (UUID 형식: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuidRegex.test(NOTION_PARENT_PAGE_ID)) {
  console.warn('⚠️ NOTION_PARENT_PAGE_ID 형식이 올바르지 않을 수 있습니다.');
  console.warn('   예상 형식: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
  console.warn(`   현재 값: ${NOTION_PARENT_PAGE_ID}`);
  console.warn('   Notion 페이지 URL에서 페이지 ID를 추출할 때 하이픈을 포함해야 합니다.');
}

// Notion 클라이언트 초기화
const notion = new Client({ auth: NOTION_TOKEN });

// 날짜 포맷팅 (YYYY-MM-DD)
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 한국 시간 기준 오늘 날짜
function getTodayKST() {
  const now = new Date();
  const kstOffset = 9 * 60; // UTC+9
  const utc = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  const kst = new Date(utc + (kstOffset * 60 * 1000));
  return kst;
}

// Git 커밋 로그 가져오기 (오늘 날짜 기준)
function getTodayCommits() {
  try {
    const today = getTodayKST();
    const todayStr = formatDate(today);
    const startOfDay = `${todayStr} 00:00:00`;
    const endOfDay = `${todayStr} 23:59:59`;

    // Git 로그 가져오기 (한국 시간 기준)
    const gitLog = execSync(
      `git log --since="${startOfDay}" --until="${endOfDay}" --pretty=format:"%h|%an|%ad|%s" --date=format:"%Y-%m-%d %H:%M:%S"`,
      { encoding: 'utf-8', cwd: process.cwd() }
    ).trim();

    if (!gitLog) {
      console.log('📝 오늘 커밋이 없습니다.');
      return [];
    }

    const commits = gitLog.split('\n').map(line => {
      const [hash, author, date, ...messageParts] = line.split('|');
      const message = messageParts.join('|');
      return {
        hash: hash.trim(),
        author: author.trim(),
        date: date.trim(),
        message: message.trim()
      };
    });

    return commits;
  } catch (error) {
    console.error('❌ Git 커밋 로그를 가져오는 중 오류 발생:', error.message);
    return [];
  }
}

// 변경된 파일 목록 가져오기
function getChangedFiles(commitHash) {
  try {
    const files = execSync(
      `git diff-tree --no-commit-id --name-only -r ${commitHash}`,
      { encoding: 'utf-8', cwd: process.cwd() }
    ).trim().split('\n').filter(Boolean);
    return files;
  } catch (error) {
    console.error(`❌ 커밋 ${commitHash}의 변경 파일을 가져오는 중 오류 발생:`, error.message);
    return [];
  }
}

// 부모 페이지 접근 권한 확인
async function verifyParentPageAccess(parentPageId) {
  try {
    const page = await notion.pages.retrieve({ page_id: parentPageId });
    console.log(`✅ 부모 페이지 접근 확인: ${page.properties?.title?.title?.[0]?.plain_text || '제목 없음'}`);
    return true;
  } catch (error) {
    console.error('❌ 부모 페이지 접근 실패:', error.message);
    console.error(`   페이지 ID: ${parentPageId}`);
    console.error('   해결 방법:');
    console.error('   1. Notion Integration이 해당 페이지에 접근 권한이 있는지 확인하세요');
    console.error('   2. 페이지를 Notion Integration과 공유했는지 확인하세요');
    console.error('   3. NOTION_PARENT_PAGE_ID 환경 변수가 올바른지 확인하세요');
    throw error;
  }
}

// Notion 페이지 검색 (제목으로)
async function findPageByTitle(parentPageId, title) {
  try {
    // 부모 페이지의 자식 페이지들을 검색
    const response = await notion.blocks.children.list({
      block_id: parentPageId,
      page_size: 100
    });

    for (const block of response.results) {
      if (block.type === 'child_page') {
        try {
          const page = await notion.pages.retrieve({ page_id: block.id });
          if (page.properties && page.properties.title) {
            const pageTitle = page.properties.title.title?.[0]?.plain_text || '';
            if (pageTitle === title) {
              return block.id;
            }
          }
        } catch (error) {
          // 개별 페이지 접근 실패는 무시하고 계속 진행
          console.warn(`⚠️ 페이지 ${block.id} 접근 실패: ${error.message}`);
        }
      }
    }

    return null;
  } catch (error) {
    console.error('❌ 페이지 검색 중 오류 발생:', error.message);
    return null;
  }
}

// Notion 페이지 생성
async function createPage(parentPageId, title, content) {
  try {
    const response = await notion.pages.create({
      parent: {
        type: 'page_id',
        page_id: parentPageId
      },
      properties: {
        title: {
          title: [
            {
              text: {
                content: title
              }
            }
          ]
        }
      }
    });

    // 페이지 내용 추가
    await addContentToPage(response.id, content);
    
    return response.id;
  } catch (error) {
    console.error('❌ 페이지 생성 중 오류 발생:', error.message);
    throw error;
  }
}

// Notion 페이지 내용 추가
async function addContentToPage(pageId, content) {
  try {
    const blocks = [];

    // 제목 추가
    blocks.push({
      object: 'block',
      type: 'heading_1',
      heading_1: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: '📋 오늘의 작업 내용'
            }
          }
        ]
      }
    });

    // 커밋별로 섹션 추가
    if (content.commits.length === 0) {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: '오늘은 커밋이 없습니다. 🎉'
              }
            }
          ]
        }
      });
    } else {
      content.commits.forEach((commit, index) => {
        // 커밋 제목
        blocks.push({
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: `커밋 ${index + 1}: ${commit.message}`
                }
              }
            ]
          }
        });

        // 커밋 정보 - 각 항목을 별도 블록으로
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: '커밋 해시: '
                }
              },
              {
                type: 'text',
                text: {
                  content: commit.hash
                },
                annotations: {
                  code: true
                }
              }
            ]
          }
        });

        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: `작성자: ${commit.author}`
                }
              }
            ]
          }
        });

        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: `시간: ${commit.date}`
                }
              }
            ]
          }
        });

        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: `변경된 파일: ${commit.files.length}개`
                }
              }
            ]
          }
        });

        // 변경된 파일 목록
        if (commit.files.length > 0) {
          blocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: '변경된 파일:'
                  },
                  annotations: {
                    bold: true
                  }
                }
              ]
            }
          });

          commit.files.forEach(file => {
            blocks.push({
              object: 'block',
              type: 'bulleted_list_item',
              bulleted_list_item: {
                rich_text: [
                  {
                    type: 'text',
                    text: {
                      content: file
                    },
                    annotations: {
                      code: true
                    }
                  }
                ]
              }
            });
          });
        }

        // 구분선
        if (index < content.commits.length - 1) {
          blocks.push({
            object: 'block',
            type: 'divider',
            divider: {}
          });
        }
      });
    }

    // 통계 섹션
    blocks.push({
      object: 'block',
      type: 'heading_1',
      heading_1: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: '📊 통계'
            }
          }
        ]
      }
    });

    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: '총 커밋 수: '
            }
          },
          {
            type: 'text',
            text: {
              content: `${content.commits.length}개`
            },
            annotations: {
              bold: true
            }
          }
        ]
      }
    });

    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: '총 변경 파일 수: '
            }
          },
          {
            type: 'text',
            text: {
              content: `${content.commits.reduce((sum, c) => sum + c.files.length, 0)}개`
            },
            annotations: {
              bold: true
            }
          }
        ]
      }
    });

    // 블록을 배치로 추가 (Notion API는 한 번에 최대 100개 블록 추가 가능)
    for (let i = 0; i < blocks.length; i += 100) {
      const batch = blocks.slice(i, i + 100);
      await notion.blocks.children.append({
        block_id: pageId,
        children: batch
      });
    }
  } catch (error) {
    console.error('❌ 페이지 내용 추가 중 오류 발생:', error.message);
    throw error;
  }
}

// Notion 페이지 내용 업데이트 (기존 내용 삭제 후 새로 추가)
async function updatePageContent(pageId, content) {
  try {
    // 기존 블록들 가져오기
    let hasMore = true;
    let startCursor = undefined;

    while (hasMore) {
      const response = await notion.blocks.children.list({
        block_id: pageId,
        start_cursor: startCursor,
        page_size: 100
      });

      // 블록 삭제 (제목 제외)
      for (const block of response.results) {
        if (block.type !== 'child_page') {
          try {
            await notion.blocks.delete({
              block_id: block.id
            });
          } catch (error) {
            // 삭제 실패는 무시 (이미 삭제된 경우 등)
          }
        }
      }

      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }

    // 새 내용 추가
    await addContentToPage(pageId, content);
  } catch (error) {
    console.error('❌ 페이지 내용 업데이트 중 오류 발생:', error.message);
    throw error;
  }
}

// 메인 함수
async function main() {
  try {
    // 부모 페이지 접근 권한 확인
    console.log('🔍 부모 페이지 접근 권한 확인 중...');
    await verifyParentPageAccess(NOTION_PARENT_PAGE_ID);

    const today = getTodayKST();
    const todayStr = formatDate(today);
    const pageTitle = `${todayStr} 작업 일지`;

    console.log(`📅 오늘 날짜: ${todayStr}`);
    console.log(`📝 페이지 제목: ${pageTitle}`);

    // 오늘의 커밋 가져오기
    const commits = getTodayCommits();
    console.log(`📦 커밋 수: ${commits.length}개`);

    // 각 커밋의 변경 파일 가져오기
    const commitsWithFiles = commits.map(commit => ({
      ...commit,
      files: getChangedFiles(commit.hash)
    }));

    const content = {
      date: todayStr,
      commits: commitsWithFiles
    };

    // 기존 페이지 검색
    const existingPageId = await findPageByTitle(NOTION_PARENT_PAGE_ID, pageTitle);

    if (existingPageId) {
      console.log('✅ 기존 페이지를 찾았습니다. 업데이트합니다...');
      await updatePageContent(existingPageId, content);
      console.log(`✅ 페이지 업데이트 완료: ${pageTitle}`);
    } else {
      console.log('📄 새 페이지를 생성합니다...');
      const pageId = await createPage(NOTION_PARENT_PAGE_ID, pageTitle, content);
      console.log(`✅ 페이지 생성 완료: ${pageTitle} (ID: ${pageId})`);
    }

    console.log('🎉 작업 완료!');
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  }
}

// 스크립트 실행
main();

