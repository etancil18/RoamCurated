// app/profile/page.tsx
"use client"

import ProfileForm from "./form"
import UserCrawls from "./UserCrawls"

export default function UserProfilePage() {
  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">🧬 User Profile</h1>
      <UserCrawls />
      <ProfileForm />
    </div>
  )
}
