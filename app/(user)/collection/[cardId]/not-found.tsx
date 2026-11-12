import Link from 'next/link';
export default function CardNotFound(){
  return <section className="bb-status-screen">
    <h1 className="page-title">카드를 찾을 수 없어요</h1>
    <p>주소가 올바른지 확인하거나 컬렉션에서 카드를 다시 선택해 주세요.</p>
    <Link className="bb-button" href="/collection">컬렉션으로</Link>
  </section>;
}
