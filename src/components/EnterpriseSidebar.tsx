import React from 'react';
import Link from 'next/link'

const EnterpriseSidebar = () => {
  return (
    <div className="w-64 h-screen bg-white shadow-lg flex flex-col justify-between p-6">
      
      {/* 메뉴 항목 */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 text-base font-medium text-gray-600 cursor-pointer hover:text-blue-600 hover:bg-gray-100 p-3 rounded-md transition-all">
          <Link href="/enterprise/counsel-form">
            <span>프로젝트 상담 신청</span>
          </Link>
        </div>
        <div className="flex items-center gap-3 text-base font-medium text-gray-600 cursor-pointer hover:text-blue-600 hover:bg-gray-100 p-3 rounded-md transition-all">
          <Link href="/enterprise/search-makers">
            <span>메이커 검색</span>
          </Link>
        </div>
        <div className="flex items-center gap-3 text-base font-medium text-gray-600 cursor-pointer hover:text-blue-600 hover:bg-gray-100 p-3 rounded-md transition-all">
          <Link href="/search-makers" target="_blank">
            <span>전체 메이커 보기</span>
          </Link>
        </div>
        <div className="flex items-center gap-3 text-base font-medium text-gray-600 cursor-pointer hover:text-blue-600 hover:bg-gray-100 p-3 rounded-md transition-all">
          <Link href="/enterprise/my-counsel">
            <span>내 프로젝트</span>
          </Link>
        </div>
        <div className="flex items-center gap-3 text-base font-medium text-gray-600 cursor-pointer hover:text-blue-600 hover:bg-gray-100 p-3 rounded-md transition-all">
          <Link href="/enterprise/estimate-review">
            <span>견적서 검토</span>
          </Link>
        </div>
        <div className="flex items-center gap-3 text-base font-medium text-gray-600 cursor-pointer hover:text-blue-600 hover:bg-gray-100 p-3 rounded-md transition-all">
          <span>완료 프로젝트</span>
        </div>
      </div>
    </div>
  );
};

export default EnterpriseSidebar;
