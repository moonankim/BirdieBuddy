'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';

// design-system/sample의 하단 내비게이션(.bottom-nav). 일반 사용자(role=user)에게만 보인다.
const icon=(children:ReactNode)=><svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{children}</svg>;
const items=[
  {href:'/home',label:'홈',icon:icon(<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>)},
  {href:'/collection',label:'카드',icon:icon(<><rect x="5" y="5" width="14" height="16" rx="2"/><path d="M8 2h11a3 3 0 0 1 3 3v13M9 10h6M9 14h4"/></>)},
  {href:'/chat',label:'채팅',icon:icon(<><path d="M21 11a8 8 0 0 1-8 8H7l-4 3V11a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z"/><path d="M7 10h10M7 14h6"/></>)},
];
export function BottomNav(){
  const pathname=usePathname()??'';
  return <nav aria-label="주요 메뉴" className="bottom-nav !fixed !left-1/2 w-full max-w-[480px] -translate-x-1/2 !rounded-b-none">
    {items.map(item=>{const active=pathname===item.href||pathname.startsWith(item.href+'/');return <Link key={item.href} href={item.href} aria-current={active?'page':undefined} className={`nav-item no-underline ${active?'active':''}`} style={{color:active?'var(--nav-active)':'var(--nav-muted)'}}><b>{item.icon}</b>{item.label}</Link>;})}
  </nav>;
}
