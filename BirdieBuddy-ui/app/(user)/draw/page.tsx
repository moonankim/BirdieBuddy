'use client';
import Link from 'next/link';
import {Guard} from '@/components/chat/shell';
// 샌드박스 자리표시 화면. 라운드 완료 → 카드팩 개봉·단계 공개 연출은 현호P 화면(app/(user)/draw/)으로 교체한다.
export default function Draw(){return <Guard role="user"><div className="stack">
  <div><span className="eyebrow">ROUND COMPLETE</span><h1 className="page-title">카드 뽑기</h1></div>
  <div className="notice stack"><strong>카드 뽑기 화면 준비 중</strong><p>카드팩 개봉과 등급 → 유형 → 이름·이미지 공개 연출은 현호P 작업이 들어올 자리예요.</p></div>
  <Link className="button secondary no-underline" href="/home">홈으로</Link>
</div></Guard>;}
