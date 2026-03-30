# Chatbot DB Design (Social-Network Ready)

## Muc tieu
- Giu backward compatibility voi code hien tai (conversations/messages/token_usage/message_feedback).
- Mo rong cho group chat, media, reaction da dang, theo doi LLM run, va luu nguon RAG co cau truc.
- Ho tro da tenant (`tenant_id`) va mo hinh mang xa hoi (follow graph).

## Bang moi
- `conversation_participants`: ho tro group chat, read state (`last_read_message_id`).
- `message_attachments`: tach image/file khoi `messages.images` JSONB.
- `message_reactions`: reaction tong quat; `message_feedback` co the tiep tuc dung cho up/down.
- `llm_message_runs`: observability, token, latency, loi theo tung message.
- `message_sources`: chuan hoa nguon RAG thay vi luu thuong trong JSONB.
- `user_follows`: lien ket follow neu app mang xa hoi can feed/quyen xem.

## Cot bo sung
- `conversations`: `tenant_id`, `conversation_type`, `visibility`, `last_message_at`, `metadata`.
- `messages`: `message_type`, `parent_message_id`, `edited_at`, `deleted_at`, `seq_no`, `metadata`.

## Mapping voi code hien tai
- API dang doc/ghi vao `messages.content`, `messages.role`, `messages.images`, `messages.sources`: van duoc giu nguyen.
- `update_last_bot_message(...)` van dung duoc.
- Co the nang cap dan:
  1. Ghi them vao `message_sources` song song `messages.sources`.
  2. Ghi them vao `message_attachments` song song `messages.images`.
  3. Chuyen dashboard token tu `token_usage` sang `llm_message_runs`.

## Chien luoc migrate an toan
1. Chay file SQL migration.
2. Deploy code moi theo kieu dual-write (JSONB + bang chuan hoa).
3. Backfill du lieu cu tu JSONB sang bang moi.
4. Chuyen read path sang bang moi.
5. Khi on dinh, co the giu JSONB de fallback hoac bo sau.
