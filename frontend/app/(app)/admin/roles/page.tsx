import { RequirePermission } from "@/components/forbidden";

import { RolesPermissionsMatrix } from "./roles-permissions-matrix";

export default function RolesPermissionsPage() {
  return (
    <RequirePermission permission="roles:read">
      <RolesPermissionsMatrix />
    </RequirePermission>
  );
}
