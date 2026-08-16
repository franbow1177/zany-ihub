import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { HomePage } from "@/pages/home"
import { InvitePage } from "@/pages/invite"
import { MembersPage } from "@/pages/members"
import { ResourcePage } from "@/pages/resource"
import { WorkspacePage } from "@/pages/workspace"

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/invite/:token" element={<InvitePage />} />
        <Route path="/workspace/:workspaceId" element={<WorkspacePage />} />
        <Route
          path="/workspace/:workspaceId/members"
          element={<MembersPage />}
        />
        <Route
          path="/workspace/:workspaceId/resource/:resourceId"
          element={<ResourcePage />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
