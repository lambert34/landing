import '@g64/ui/styles.css'; import './admin.css'; import Link from 'next/link'; import { BrandLogo } from '@g64/ui';
const links=[['Dashboard','/'],['Users','/users'],['Transactions','/transactions'],['Swaps','/swaps'],['System','/system']];
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><div className="admin-shell"><aside><BrandLogo admin/><nav>{links.map(([label,url])=><Link href={url!} key={label}>{label}</Link>)}</nav><span>Phase 0 · Preview</span></aside><main>{children}</main></div></body></html>}
