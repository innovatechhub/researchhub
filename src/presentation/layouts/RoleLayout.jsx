import { PortalLayout } from './PortalLayout';

export function RoleLayout({ portalLabel, navItems = [] }) {
  return <PortalLayout portalLabel={portalLabel} navItems={navItems} />;
}
