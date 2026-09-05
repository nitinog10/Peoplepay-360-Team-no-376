import { MyProfile } from "@/components/employees/my-profile";
import { RequirePermission } from "@/components/forbidden";

export default function MyProfilePage() {
  return (
    <RequirePermission permission="employees:read">
      <MyProfile />
    </RequirePermission>
  );
}
