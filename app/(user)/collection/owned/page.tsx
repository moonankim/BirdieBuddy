import {Guard} from '@/components/chat/shell';
import {CardCollection} from '@/components/card/card-collection';
export default function OwnedCardsPage(){return <Guard role="user"><CardCollection/></Guard>;}
