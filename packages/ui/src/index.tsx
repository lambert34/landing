import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
export function BrandLogo({ admin = false }: { admin?: boolean }) { return <span className="brand">G64{admin && <small>Admin</small>}</span>; }
export function Button({ className='', variant='primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary'|'secondary'|'ghost' }) { return <button className={`button button--${variant} ${className}`} {...props} />; }
export function Card({ children, className='' }: { children: ReactNode; className?: string }) { return <section className={`card ${className}`}>{children}</section>; }
export function Input(props: InputHTMLAttributes<HTMLInputElement>) { return <input className="input" {...props} />; }
export function Badge({ children }: { children: ReactNode }) { return <span className="badge">{children}</span>; }
export function Container({ children, className='' }: { children: ReactNode; className?: string }) { return <div className={`container ${className}`}>{children}</div>; }
export function PageHeader({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) { return <header className="page-header">{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</header>; }
