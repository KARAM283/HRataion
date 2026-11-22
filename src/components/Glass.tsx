import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

type SurfaceProps = HTMLAttributes<HTMLElement> & { children?: ReactNode };
export function GlassCard({className="",children,...props}:SurfaceProps){return <section className={`glass-card ${className}`} {...props}>{children}</section>}
export function GlassPanel({className="",children,...props}:HTMLAttributes<HTMLDivElement>){return <div className={`glass-panel ${className}`} {...props}>{children}</div>}
export function GlassSidebar({className="",children,...props}:HTMLAttributes<HTMLElement>){return <aside className={`glass-sidebar ${className}`} {...props}>{children}</aside>}
export function GlassNavbar({className="",children,...props}:HTMLAttributes<HTMLElement>){return <header className={`glass-navbar ${className}`} {...props}>{children}</header>}
export function GlassButton({className="",children,...props}:ButtonHTMLAttributes<HTMLButtonElement>){return <button className={`glass-button ${className}`} {...props}>{children}</button>}
export function GlassInput({className="",...props}:InputHTMLAttributes<HTMLInputElement>){return <input className={`glass-input ${className}`} {...props}/>}
export function GlassModal({className="",children,...props}:HTMLAttributes<HTMLDivElement>){return <div className={`glass-modal ${className}`} {...props}>{children}</div>}
