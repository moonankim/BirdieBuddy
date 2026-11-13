'use client';
import {Spinner} from '@/components/ui';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {accounts,dataMode,homeFor,useSession} from '@/lib/session';

// 실제 모드 데모 계정(scripts/setup-demo-accounts.mjs). 암호는 .demo-passwords.json(로컬 전용)에만 있으므로 화면에 두지 않는다.
const demoEmails=[
  {label:'사용자 A',email:'user-a@example.test'},
  {label:'사용자 B',email:'user-b@example.test'},
  {label:'인플루언서 1',email:'influencer@example.test'},
  {label:'심사 대기 인플루언서',email:'pending-influencer@example.test'},
  {label:'관리자',email:'admin@example.test'},
];
const signInError=(code:string)=>code==='UNAUTHENTICATED'?'이메일 또는 암호가 맞지 않아요.':code==='FORBIDDEN'?'프로필이 없는 계정이에요. 관리자에게 문의해 주세요.':'로그인하지 못했어요. 다시 시도해 주세요.';

function EmailLogin(){
  const s=useSession();const router=useRouter();
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');
  const [pending,setPending]=useState(false);const [error,setError]=useState('');
  return <form className="stack" onSubmit={async e=>{e.preventDefault();setError('');setPending(true);
    try{const r=await s.signIn(email,password);if(r.ok)router.replace(homeFor(r.data));else setError(signInError(r.error.code));}finally{setPending(false);}}}>
    <label className="field-label stack">이메일<input className="input" type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required aria-invalid={!!error}/></label>
    <label className="field-label stack">암호<input className="input" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required aria-invalid={!!error}/></label>
    {error&&<p role="alert" className="notice error">{error}</p>}
    <button className="button" disabled={pending||!email.trim()||!password} aria-busy={pending}>{pending?'로그인 중...':'로그인'}</button>
    <div className="stack">
      <p className="footnote !mt-2">데모 계정 이메일 채우기 (암호는 .demo-passwords.json 확인)</p>
      <div className="flex flex-wrap gap-2">{demoEmails.map(d=><button key={d.email} type="button" className="badge gray min-h-[var(--touch-target)] border-0" onClick={()=>{setEmail(d.email);setError('');}}>{d.label}</button>)}</div>
    </div>
  </form>;
}

function MockLogin(){
  const s=useSession();const router=useRouter();
  const [error,setError]=useState('');const [pending,setPending]=useState<string|null>(null);
  return <><div className="grid gap-2" aria-busy={pending!==null}>{Object.entries(accounts).map(([key,user])=><button className="card flex min-h-[var(--touch-target)] items-center justify-between border-0 text-left font-bold disabled:opacity-60" key={key} disabled={pending!==null} onClick={async()=>{setError('');setPending(key);try{const result=await s.signIn(key,'');if(result.ok) router.replace(homeFor(result.data));else setError('로그인하지 못했어요. 다시 시도해 주세요.');}finally{setPending(null);}}}>{user.nickname} <span className="badge gray">{pending===key?'로그인 중...':`(${key})`}</span></button>)}</div>{error&&<p role="alert" className="notice error">{error}</p>}</>;
}

export default function Login(){
  const s=useSession();const router=useRouter();
  useEffect(()=>{if(s.status==='signedIn')router.replace(homeFor(s.user));},[s,router]);
  if(s.status==='loading')return <Spinner label="세션을 확인하고 있어요."/>;
  if(s.status==='signedIn')return <Spinner label="이동 중..."/>;
  return dataMode==='supabase'
    ?<section className="stack pt-4"><div><span className="eyebrow">LOGIN</span><h1 className="page-title">로그인</h1></div><p className="muted text-[length:var(--type-label)]">시연용 데모 계정으로 로그인해요.</p><EmailLogin/></section>
    :<section className="stack pt-4"><div><span className="eyebrow">DEMO</span><h1 className="page-title">더미 계정으로 시작</h1></div><p className="muted text-[length:var(--type-label)]">목 데이터로 동작하는 미리보기 계정입니다. 팬은 채팅방 목록으로 이동합니다.</p><MockLogin/></section>;
}
