export type UUID = string;
export type MessageId = string;
export type Grade = 'common' | 'rare' | 'epic' | 'special';
export type Style = 'illust' | 'retro' | 'holo';
export type InfluencerType = 'youtuber' | 'media_pro' | 'tour';
export type SupportBadge = 'none' | 'buddy' | 'eagle' | 'albatross';
export type MessageKind = 'user_question' | 'influencer_answer' | 'influencer_broadcast' | 'greeting';

export type ApiError = {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
};

export type Result<T> = { ok: true; data: T } | { ok: false; error: ApiError };
export type Page<T> = { items: T[]; nextCursor: string | null };

export type CardTemplate = {
  id: UUID;
  influencerId: UUID;
  influencerName: string;
  influencerType: InfluencerType;
  verifiedAt: string | null;
  style: Style;
  imageUrl: string;
};

export type CollectionItem = {
  template: CardTemplate;
  counts: Record<Grade, number>;
  totalCards: number;
  highestGrade: Grade | null;
};

export type OwnedCardItem = { template: CardTemplate; grade: Grade; count: number };

export type Membership = {
  roomId: UUID;
  status: 'active' | 'left';
  gauge: number;
  joinedAt: string;
  joinedMonth: string;
  leftAt: string | null;
  leftMonth: string | null;
};

export type RoundGaugeSummary = {
  currentMonth: string;
  monthlyRoundCount: number;
  targetRounds: number;
  remainingRounds: number;
};

export type AdvanceDemoMonthData = {
  closedMonth: string;
  currentMonth: string;
  applied: boolean;
  members: {
    roomId: UUID;
    userId: UUID;
    roundCount: number;
    previousGauge: number;
    gauge: number;
    status: 'active' | 'left';
  }[];
};

export type RoomCatalogItem = {
  roomId: UUID;
  influencerId: UUID;
  influencerName: string;
  influencerType: InfluencerType;
  verifiedAt: string;
  profileImageUrl: string | null;
  requiredCards: number;
  earnedCards: number;
  missingCards: number;
  supportBadge: SupportBadge;
  cardStatus: 'ready' | 'preparing';
  canJoin: boolean;
  joinReason: 'eligible' | 'need_cards' | 'already_active' | 'rejoin_rounds_needed' | 'card_preparing';
  currentMonthRoundCount: number;
  requiredRoundsToRejoin: number;
  membership: Membership | null;
};

export type Message = {
  id: MessageId;
  roomId: UUID;
  senderId: UUID;
  senderType: 'user' | 'influencer';
  messageKind: MessageKind;
  recipientUserId: UUID | null;
  senderName: string;
  body: string | null;
  replyTo: MessageId | null;
  replyContext: string | null;
  deletedAt: string | null;
  passesAllFilters: boolean | null;
  isReplyToMe: boolean;
  createdAt: string;
  updatedAt: string;
  clusterId: UUID | null;
  supportBadge: SupportBadge | null;
  ownScore: number | null;
  qualityScore: number | null;
  priority: number | null;
};

export type MessageChangeCursor = { updatedAt: string; id: MessageId };
export type MessageChangesPage = { items: Message[]; nextCursor: MessageChangeCursor | null };
export type ReconcileRoomMessagesInput = {
  roomId: UUID;
  currentMessages: readonly Message[];
  checkpoint: MessageChangeCursor | null;
};
export type ReconcileRoomMessagesData = {
  messages: Message[];
  checkpoint: MessageChangeCursor | null;
};

export type InboxItemBase = {
  inboxKey: string;
  priority: number;
  tieMessageId: MessageId;
  replyTo: MessageId;
  answered: boolean;
  replyId: MessageId | null;
};

export type InboxItem =
  | (InboxItemBase & {
      kind: 'question';
      expectedClusterId: null;
      expectedClusterVersion: null;
      question: Message;
    })
  | (InboxItemBase & {
      kind: 'cluster';
      expectedClusterId: UUID;
      expectedClusterVersion: number;
      clusterId: UUID;
      representative: string;
      memberCount: number;
      activeMessageIds: MessageId[];
    });

export type InboxPage = Page<InboxItem> & { revision: string };
export type RoomGreeting = { roomId: UUID; text: string; isDefault: boolean; maxLength: 200; version: number };
export type RoomDailyBlockCount = { roomId: UUID; day: string; count: number };
export type MyInfluencerProfile = {
  influencerId: UUID;
  influencerName: string;
  verifiedAt: string;
  profileImageUrl: string | null;
  fallbackImageUrl: string | null;
};
export type Verification = {
  id: UUID;
  influencerId: UUID;
  type: InfluencerType;
  evidenceUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
};

export type SubmitMessageInput = {
  requestId: UUID;
  roomId: UUID;
  body: string;
  suggestionToken?: string;
};
export type SubmitMessageData =
  | {
      verdict: 'pass'; message: Message; category: null; reason: null; rewrite: null;
      rewriteQuality: null; suggestionToken: null; expiresAt: null; passesAllFilters: boolean;
    }
  | {
      verdict: 'suggest';
      category: string;
      reason: string;
      rewrite: string | null;
      rewriteQuality: number | null;
      suggestionToken: string | null;
      expiresAt: string | null;
      passesAllFilters: false;
      message: null;
    }
  | {
      verdict: 'block'; category: string; reason: string; rewrite: null;
      rewriteQuality: null; suggestionToken: null; expiresAt: null;
      passesAllFilters: false; message: null;
    };

export type ClusterQuestion = {
  id: UUID;
  representative: string;
  memberCount: number;
  messageIds: MessageId[];
};
export type ClusterQuestionsData = { roomId: UUID; clusters: ClusterQuestion[] };
export type SummaryData = { roomId: UUID; summary: string; sourceMessageIds: MessageId[]; generatedAt: string };

export type GameConfigEntry = { key: string; value: unknown; version: number; updatedAt: string };
export type RoomFilters = {
  roomId: UUID;
  disabledFilters: string[];
  mandatoryFilters: string[];
  version: number;
};
export type UpdateRoomFiltersData = { roomId: UUID; disabledFilters: string[]; version: number };
export type ApproveVerificationData = { verification: Verification; verifiedAt: string | null };
export type CompleteRoundData = {
  roundId: UUID;
  drawId: UUID;
  grade: Grade;
  template: CardTemplate;
  isNew: boolean;
  ownedCount: number;
  entryUnlocked: boolean;
};
export type UpgradeCardData = {
  templateId: UUID;
  fromGrade: Grade;
  toGrade: Grade;
  consumed: number;
  remainingCount: number;
  upgradedCount: number;
};
export type JoinRoomData = { membership: Membership; alreadyActive: boolean; welcomeMessage: Message | null };

export type SubscribeRoomMessagesStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CHANNEL_ERROR' | 'CLOSED';
export type SubscribeRoomMessagesInput = {
  roomId: UUID;
  onMessage: (message: Message) => void;
  onStatus: (status: SubscribeRoomMessagesStatus, error?: Error) => void;
  onMessageEnrichmentError?: (messageIds: readonly MessageId[]) => void;
};

export type BackendApi = {
  completeRound(input: { requestId: UUID; forceGrade?: Grade | null }): Promise<Result<CompleteRoundData>>;
  getCollection(): Promise<Result<{ items: CollectionItem[] }>>;
  getOwnedCards(): Promise<Result<{ items: OwnedCardItem[] }>>;
  upgradeCard(input: { requestId: UUID; templateId: UUID; grade: Grade }): Promise<Result<UpgradeCardData>>;
  getRooms(): Promise<Result<{ items: RoomCatalogItem[] }>>;
  joinRoom(input: { requestId: UUID; roomId: UUID }): Promise<Result<JoinRoomData>>;
  getMyMembership(input: { roomId: UUID }): Promise<Result<Membership | null>>;
  getMyRoundGaugeSummary(): Promise<Result<RoundGaugeSummary>>;
  getAdminDemoMonth(): Promise<Result<string>>;
  advanceDemoMonth(input: { requestId: UUID; targetMonth: string }): Promise<Result<AdvanceDemoMonthData>>;
  getMessages(input: { roomId: UUID; beforeId?: MessageId; afterId?: MessageId; limit?: number }): Promise<Result<Page<Message>>>;
  submitMessage(input: SubmitMessageInput): Promise<Result<SubmitMessageData>>;
  getRoomMessageCheckpoint(input: { roomId: UUID }): Promise<Result<MessageChangeCursor | null>>;
  getMessageChanges(input: {
    roomId: UUID;
    checkpoint: MessageChangeCursor | null;
    through: MessageChangeCursor | null;
    cursor?: MessageChangeCursor | null;
    limit?: number;
  }): Promise<Result<MessageChangesPage>>;
  reconcileRoomMessages(input: ReconcileRoomMessagesInput): Promise<Result<ReconcileRoomMessagesData>>;
  subscribeRoomMessages(input: SubscribeRoomMessagesInput): () => void;
  getRoomInbox(input: { roomId: UUID; includeAnswered?: boolean; cursor?: string | null; limit?: number }): Promise<Result<InboxPage>>;
  replyToMessage(input: {
    requestId: UUID;
    roomId: UUID;
    replyTo: MessageId;
    expectedClusterId: UUID | null;
    expectedClusterVersion: number | null;
    body: string;
  }): Promise<Result<Message>>;
  sendBroadcast(input: { requestId: UUID; roomId: UUID; body: string }): Promise<Result<Message>>;
  deleteInfluencerMessage(input: { requestId: UUID; roomId: UUID; messageId: MessageId }): Promise<Result<{ message: Message }>>;
  getRoomGreeting(input: { roomId: UUID }): Promise<Result<RoomGreeting>>;
  updateRoomGreeting(input: { requestId: UUID; roomId: UUID; expectedVersion: number; text: string }): Promise<Result<RoomGreeting>>;
  getRoomDailyBlockCount(input: { roomId: UUID }): Promise<Result<RoomDailyBlockCount>>;
  summarizeRoom(input: { requestId: UUID; roomId: UUID }): Promise<Result<SummaryData>>;
  clusterQuestions(input: { requestId: UUID; roomId: UUID }): Promise<Result<ClusterQuestionsData>>;
  requestVerification(input: { requestId: UUID; type: InfluencerType; evidenceUrl: string }): Promise<Result<{ verification: Verification }>>;
  getMyVerifications(input?: { cursor?: string | null; limit?: number }): Promise<Result<Page<Verification>>>;
  getPendingVerifications(input?: { cursor?: string | null; limit?: number }): Promise<Result<Page<Verification>>>;
  approveVerification(input: {
    requestId: UUID;
    verificationId: UUID;
    decision: 'approved' | 'rejected';
    reason?: string | null;
  }): Promise<Result<ApproveVerificationData>>;
  getMyInfluencerProfile(): Promise<Result<MyInfluencerProfile>>;
  uploadInfluencerProfilePhoto(input: { requestId: UUID; file: File }): Promise<Result<MyInfluencerProfile>>;
  getGameConfig(): Promise<Result<GameConfigEntry[]>>;
  updateGameConfig(input: { requestId: UUID; key: string; value: unknown; expectedVersion: number }): Promise<Result<GameConfigEntry>>;
  getRoomFilters(input: { roomId: UUID }): Promise<Result<RoomFilters>>;
  updateRoomFilters(input: {
    requestId: UUID;
    roomId: UUID;
    disabledFilters: string[];
    expectedVersion: number;
  }): Promise<Result<UpdateRoomFiltersData>>;
};
