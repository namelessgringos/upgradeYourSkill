# Trainer Persona — interview findings (n=2)

Synthesis of the 10-question interview ([`questionnaire.uk.html`](./questionnaire.uk.html))
sent to two working personal trainers. Raw answers in the appendix.

**Sample warning:** two respondents, both low-tech, both currently solo. Neither
runs a studio *today*. Treat everything below as directional, not settled.

- **Trainer A** — higher volume, more structured. Injury rehab + weight goals,
  long-cycle coaching ("we set the number on day one and go until we hit it").
- **Trainer B** — solo, individual clients only, small book. Previously ran a
  studio with higher throughput.

## Per-question comparison

| # | Question | Trainer A | Trainer B |
|---|---|---|---|
| 1 | New client, start to finish — what gets recorded, where | No described process. Goal number fixed at first session; injury assessed. Everything ends up in the client chat | Phone Notes (iCloud) + memory |
| 2 | Updating info later (goal, injury, weight) | Same chat | Same Notes |
| 3 | "How is this client vs 3 months ago" | **Did not understand the question** | Clients film themselves and send it; "I see their results anyway" — doesn't require it |
| 4 | Last program — blank page or copy? Where do programs live | In client chats. No templates. Emphasis on constant progression | Some sequences in a paper notebook; session assembled on the fly from memory |
| 5 | Session scheduling / reminders | Google Calendar, synced to iPhone. Everything there | In their head. Sometimes calendar, sometimes pinned Telegram messages |
| 6 | Spreadsheets | No. Tried, dropped — no template exists, everything adapts to client state | No. Used them back when there was a studio and more people |
| 7 | Paid client-management app | Hevy, free tier. Sees it as a strong competitor. Never got as far as running clients through it (needs paid). Uses chat search instead | Never tried one |
| 8 | Rep counting / technique checking | Not systematic | Counts reps in head, watches technique; can't always catch everything live in one session |
| 9 | Most annoying repeating non-training task | **Session accounting.** Solved it with Claude wired to the calendar, counting sessions per client. Requires very careful calendar hygiene or the numbers drift. Backups: paper notebook + client chat as cross-check | Nothing comes to mind |
| 10 | Phone dies, all notes gone — what would actually hurt | Almost everything is recoverable. Strength numbers were written into each client's chat, so the client still has them | Doesn't know. No group clients; knows every individual, their contacts and their info; would just ask again |

## Patterns

**1. Pain scales with volume, not with role.** Trainer B has no felt pain
(Q9: "nothing"), no data-loss anxiety (Q10: "I'd just ask again"), and no need
for progress comparison (Q3). Trainer A — more clients, more structure — has
real friction. A tool aimed at the low-volume solo trainer is solving a problem
they do not have.

**2. Chat and Notes *are* the database.** Neither uses a dedicated system.
Retrieval is chat search (A) or memory (B). Any product that requires re-entering
this data elsewhere is asking them to abandon a store that already works.

**3. Rejecting templates is a philosophy, not a gap.** A: no template exists,
everything adapts to client state and needs. B: composes the session on the fly.
Both dropped spreadsheets for the same reason. A product that opens with "create
a program template" fights its user on the first screen.

**4. Data-loss fear is near zero.** Both said the loss would be survivable.
"Your data is safe with us" is not a wedge here. Backup and sync are hygiene,
not value.

**5. Neither pays.** A knows Hevy, likes it, stayed on free — adoption died
exactly at the paid-to-manage-clients step. B never tried anything. The barrier
is the price-plus-migration threshold, not awareness.

**6. Redundancy appears only where the number carries money.** A triple-checks
session counts (Claude + calendar, paper notebook, client chat) and checks
nothing else that way. Session count is presumably tied to packages and payment.
That is the one place where being wrong has a consequence.

**7. Client-side progress capture already happens for free.** B's clients film
themselves and send it, unprompted and unrequired. An input channel exists that
nobody built.

## Implications for the persona

**Deprioritize or kill:**
- Excel import/sync (Q6 → both rejected spreadsheets, independently, for
  reasons that will not change)
- Rigid program templates and routine builders (pattern 3)
- Backup/safety as a value proposition (pattern 4)
- Group/team features — neither has group clients

**Strengthen:**
- **Calendar-driven session ledger.** The single confirmed pain, and the only
  money-adjacent one. A already built a hand-rolled version of it.
- **Freeform client story capture** that behaves like Notes, not like a form.
  Both trainers' capture is unstructured prose today; a schema-first UI loses to
  Apple Notes.
- **Chat-first ingestion.** The data already exists in chat threads. Reading
  from there beats asking for re-entry.

**Reframe:**
- "Progress vs 3 months ago" was *our* hypothesis, not their request. A could
  not parse the question; B does not need it. It should fall out for free from a
  session log plus strength numbers — it should not headline the product.

**Strongest signal in either interview:** Trainer A independently wired Claude
to their Google Calendar to count sessions per client, and keeps a paper notebook
as a check on it. A trainer built an LLM tool for this by hand, and still doesn't
fully trust it. That is the wedge — accurate, low-effort session accounting off
the calendar they already keep.

## Still unknown

- **Payments and packages were never asked about directly.** A's session counting
  strongly implies package tracking. If money is the real job-to-be-done, the
  questionnaire missed it.
- **Willingness to pay.** Neither converted free → paid. Unpriced.
- **Q4 for Trainer A is truncated** — fresh-page vs copy is still unresolved for
  the higher-volume respondent.
- **No trainer interviewed while actively running a studio.** B's studio
  experience is retrospective, and notably that was when spreadsheets *did* get
  used — the one data point suggesting the pain returns with volume.

## Recommended next steps

1. **Three-question follow-up** to both: packages/payment tracking, Q4 re-ask for
   A, and what would have made them upgrade Hevy.
2. **Do not spec the CRM yet.** The evidence supports something much narrower
   than `NOTES.md` scoped: a calendar-driven session ledger plus freeform client
   notes, fed from chat.
3. **Find one high-volume trainer** to interview. Both current respondents sit at
   the low end where the problem barely exists.

## Appendix — raw answers

Reproduced as sent, lightly trimmed where the message was cut off mid-word.

### Trainer A (Ukrainian)

> В цілому працюю над усуненням травми поки не буду впевнений в здатності
> людини при будь яких розкладах бути впевненим що травма не повернеться. Якщо
> про ціль то ми визначаємо цифру на самому початку і йдемо до неї до тих пір
> поки її не досягнемо. Оскільки я не тільки показую як займатись а і вчу людину
> то процес довгий але потім вага котру ми скинули не повертається назад. А
> навіть якщо є обставини котрі повернули вагу то людина вміє сама з цим
> справитись.
>
> 3. Не зрозумів питання
>
> 4. Програми тренувань живуть в чатах з клієнтом, щоб якщо в нього з'явило…
> [обірвано] …креативні з постійною прогресією навантаження.
>
> 5. Все в гугл календарі який підключено і синхронізовано з календарем в Айфоні.
>
> 6. Таблицями не користуюсь, раніше пробував але це для мене формат не підходить
> оскільки в мене нема шаблону по якому я треную людей. Все дуже сильно
> адаптується під стан та потреби клієнта.
>
> 7. Мав досвід з програмою Hevy, в цілому бачу її як сильного конкурента,
> користувався безкоштовною версією але так і не дійшов до того щоб вести так
> клієнтів та свої тренування. Щоб вести клієнтів то потрібно платну версію ніби.
> А для мене — якщо потрібно щось знайти я просто користуюся пошуком в чаті.
>
> 9. В цілому облік тренувань, але я це вирішив за допомогою Клода — він
> синхронізований з календарем і відслідковує кількість тренувань кожного
> клієнта, але потрібно дуже уважно вести календар щоб не було похибок. В мене є
> запасний варіант (блокнот) і чат з людиною, це як перевірка правильності Клода.
>
> 10. Та в цілому відновити можна все. Силові результати є в кожного з клієнтів,
> тобто це не тільки відчуття ваги а і те що я писав кожному в чаті — якщо воно
> пропало в мене, то в людини з якою я вів пере… [обірвано]

### Trainer B (Russian)

> 1. Что-то фиксирую в заметках телефона, что-то в голове. Заметки сохраняются в
> айклауд.
>
> 2. Обновляю информацию так же в заметках.
>
> 3. Обычно мои девочки сами фиксят свой прогресс, снимая видео, и пишут мне
> затем. Но я этого не требую, я и так вижу их результаты.
>
> 4. Прописываю в тетради некоторые последовательности, занятие формирую в
> процессе из головы.
>
> 5. В голове) Иногда календарь, иногда в закреплённых в ТГ.
>
> 6. Не веду таблицы, вела когда была студия и поток людей был больше.
>
> 7. Не пользовалась.
>
> 8. Повторения в голове считаю, технику смотрю, не всегда получается отследить
> прям всё за одно занятие в режиме онлайн.
>
> 9. Ничего не приходит в голову, честно говоря.
>
> 10. И здесь даже не знаю, у меня нет групповых, все кто на индивах — я всех
> хорошо знаю, и контакты, и инфо, если надо то переспрошу.
