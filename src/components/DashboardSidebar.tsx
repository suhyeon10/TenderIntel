'use client';

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { getClientTeamAndMilestones } from '@/apis/estimate.service';

const DashboardSidebar = () => {
  const router = useRouter();
  const params = useParams();

  const [counseld, setCounseld] = useState<string | null>(
    typeof window !== "undefined" ? sessionStorage.getItem("counselId") : null
  );
  const [inProgressExists, setInProgressExists] = useState(false);
  const [counselExists, setCounselExists] = useState(false);
  const clientId = 'baa0fd5e-4add-44f2-b1df-1ec59a838b7e';

  useEffect(() => {
    if (params?.counselId && /^\d+$/.test(params.counselId as string)) {
      setCounseld(params.counselId as string);
      sessionStorage.setItem("counselId", params.counselId as string);
    }
  }, [params]);

  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        if (counseld) {
          const data = await getClientTeamAndMilestones(clientId, Number(counseld), ["in_progress", "accept"]);
          if (data?.milestones) {
            setInProgressExists(data.milestones.some(m => m.milestone_status === "in_progress"));
            setCounselExists(data.estimate.estimate_status === "accept" || data.estimate.estimate_status === "in_progress");
          }
        }
      } catch (error) {
        console.error("프로젝트 및 상담 현황 데이터 불러오기 실패:", error);
      }
    };

    fetchStatuses();
  }, [counseld]);

  const generateHref = (path: string) => {
    let basePath = `/${path}`;
    const idToUse = counseld ?? (params?.counselId as string);

    if (idToUse) {
      basePath += `/${idToUse}`;
    }

    return basePath;
  };

  return (
    <aside
      style={{
        display: "flex",
        flexDirection: "column",
        width: "250px",
        padding: "20px",
        backgroundColor: "#2C3E50",
        height: "100vh",
        color: "#ECF0F1",
        boxShadow: "4px 0 6px rgba(0, 0, 0, 0.1)",
        borderRight: "1px solid #34495E",
      }}
    >
      <nav style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
        {/* 작성된 견적서 목록 */}
        <div
          style={{
            padding: "15px",
            backgroundColor: "#34495E",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            transition: "background-color 0.3s ease",
          }}
        >
          <Link
            href={generateHref("enterprise/estimate-list")}
            style={{
              textDecoration: "none",
              color: "#ECF0F1",
              fontSize: "16px",
              fontWeight: "500",
              display: "block",
            }}
          >
            작성된 견적서 목록
          </Link>
        </div>

        {/* 상담 현황 */}
        <div
          style={{
            padding: "15px",
            backgroundColor: "#34495E",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            transition: "background-color 0.3s ease",
            opacity: counselExists ? 1 : 0.5,
            pointerEvents: counselExists ? "auto" : "none",
          }}
        >
          <Link
            href={generateHref("enterprise/counsel-status")}
            style={{
              textDecoration: "none",
              color: "#ECF0F1",
              fontSize: "16px",
              fontWeight: "500",
              display: "block",
            }}
          >
            상담 현황
          </Link>
        </div>

        {/* 진행 중인 프로젝트 */}
        <div
          style={{
            padding: "15px",
            backgroundColor: "#34495E",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            transition: "background-color 0.3s ease",
            opacity: inProgressExists ? 1 : 0.5,
            pointerEvents: inProgressExists ? "auto" : "none",
          }}
        >
          <Link
            href={generateHref("enterprise/manager-team")}
            style={{
              textDecoration: "none",
              color: "#ECF0F1",
              fontSize: "16px",
              fontWeight: "500",
              display: "block",
            }}
          >
            진행 중인 프로젝트
          </Link>
        </div>
      </nav>

      <footer style={{ marginTop: "30px", textAlign: "center", fontSize: "14px" }}>
        <div>기업명</div>
        <div>gal123@naver.com</div>
      </footer>
    </aside>
  );
};

export default DashboardSidebar;
