import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function InvitePage() {
  const navigate = useNavigate();
  const { inviteCode } = useParams();
  const code = inviteCode || window.location.pathname.split("/").pop() || "";
  
  useEffect(() => {
    // シナリオコードが指定されている場合は、LINEログインページにリダイレクト
    if (code) {
      console.log("Redirecting to LINE login for scenario:", code);
      navigate(`/login?scenario=${encodeURIComponent(code)}`);
    }
  }, [code, navigate]);

  // リダイレクト中の表示
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h1 className="text-xl font-bold mb-4">LINE認証ページに移動中...</h1>
        <p className="text-sm text-gray-600">
          自動的にLINE認証ページにリダイレクトされます
        </p>
      </div>
    </div>
  );
}