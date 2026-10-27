# CODEX MASTER BUILD PROMPT
# PROJECT: THE HOLOGRAPHIC BRAIN
### A personal AI memory operating system inspired by the anatomy and cognition of the human brain

## 0. YOUR ROLE AND MISSION

You are acting as a multidisciplinary engineering and design team comprising:

- Principal full-stack software architect
- Senior Three.js / WebGL / React Three Fiber engineer
- Medical 3D visualisation specialist
- Computational neuroscience consultant
- AI systems and retrieval engineer
- Database and knowledge graph architect
- Senior UI/UX designer specialising in futuristic interactive interfaces
- Security and privacy engineer
- Quality assurance and performance engineer

Your mission is to **design, develop, test and iteratively improve a fully functional, cloud-hosted personal AI operating system represented by an interactive, anatomically detailed holographic human brain.**

This is not a concept-art assignment, landing-page exercise, dashboard mockup or generic AI chatbot.

Build a real, persistent application.

The user previously attempted an early draft that looked like generic AI-generated design. That outcome is unacceptable.

The ultimate experience should evoke the scientific detail, dimensionality and visual sophistication of JARVIS-style holographic technology from Iron Man, without copying its proprietary artwork or interface assets.

**The human brain is the interface. Every memory, note, conversation and meaningful association should have a place within it.**

Do not substitute a generic spherical particle cloud, decorative wireframe or vaguely brain-shaped mesh.

---

# 1. NON-NEGOTIABLE PRODUCT PRINCIPLES

1. Anatomical accuracy takes precedence over decorative effects.
2. The visual experience must be genuinely three-dimensional.
3. Memory nodes must represent real stored information, not random decorative particles.
4. The system must preserve original source material alongside summaries and extracted insights.
5. Every meaningful memory association must be inspectable and explainable.
6. User data must persist securely between sessions and devices.
7. The application must support natural-language and voice-based interaction.
8. AI responses must distinguish retrieved facts from generated inferences.
9. Connectors must use supported, authorised integrations. Never simulate access to private accounts.
10. The product must feel like one cohesive personal intelligence system, not multiple disconnected tools.
11. A feature is not complete merely because a button, screen or placeholder exists.
12. The interface must remain usable and performant as the memory collection grows.

Implement incrementally, but preserve the full product vision.

---

# 2. THE CENTRAL VISUAL EXPERIENCE

## 2.1 Anatomically accurate human brain

The main application should open to a large, floating, fully three-dimensional human brain occupying the central viewing area.

The underlying anatomical representation must have medically credible surface geometry.

Include:

- Left and right cerebral hemispheres
- Realistic cortical folding
- Gyri and sulci
- Longitudinal fissure
- Frontal lobes
- Parietal lobes
- Temporal lobes
- Occipital lobes
- Correct relative anatomical proportions
- Recognisable boundaries between lobes
- Anatomically plausible orientation from all viewing angles

Where feasible, include the cerebellum and brainstem as secondary anatomical structures, with their own accurate geometry.

Do not invent anatomy merely to make the model look futuristic.

### Anatomical source requirements

Do not attempt to generate the primary brain geometry from a random mathematical surface, procedural noise or a text-to-3D approximation.

Research and evaluate reputable anatomical assets or medical segmentation datasets with clear licensing, such as appropriate open neuroimaging atlases, anatomical meshes or MRI-derived cortical surfaces.

Choose an appropriate source with documented provenance and permitted usage rights.

Maintain original anatomical geometry as a registered spatial scaffold. Optimise meshes and level of detail without destroying major anatomical features.

If a medically credible asset cannot be located, implement the surrounding application architecture and provide an explicit asset-integration requirement rather than passing off inaccurate geometry as complete.

## 2.2 Fully holographic visual treatment

The brain must appear as a transparent, luminous, floating hologram.

Desired characteristics:

- Translucent cortical surface
- Hundreds to thousands of visible luminous points, scaling as real memories are added
- Delicate luminous neural pathways
- Soft bloom and controlled light scattering
- Internal depth and subtle volumetric appearance
- Visually layered anatomical structures
- Carefully controlled glow intensity
- Soft motion with minimal visual noise
- Strong depth perception when rotated
- Sophisticated scientific rather than cartoon-like styling

Background:

Near-black or extremely dark navy, with minimal visual distractions.

Avoid excessive interface ornaments, heavy gradients, oversized cards and unrelated science-fiction decorations.

The hologram should look like a sophisticated interactive medical visualisation enhanced with futuristic computation.

## 2.3 Four colour-coded cerebral lobes

The four cerebral lobes must have distinct, visually elegant colours.

Use these proposed defaults, adjustable through settings:

| Region | Primary colour | Knowledge association |
|---|---|---|
| Frontal | Electric blue | Planning, strategy, decisions, goals |
| Parietal | Violet | Relationships, categorisation, conceptual knowledge |
| Temporal | Cyan | Conversations, language, audio, autobiographical memory |
| Occipital | Amber-gold | Images, videos, visual references, creative material |

The colours must remain restrained, professional and harmonious.

Medical anatomy and software categorisation must remain separate concepts. The software uses the four cerebral lobes as a **metaphorical information architecture**, not as a claim that human memories are literally stored according to these categories.

A piece of information can belong to multiple functional categories, but must have one primary visual anchor and may link to nodes elsewhere.

Lobe boundaries must remain anatomically plausible.

## 2.4 The brain is composed of memory dots

This is a critical product requirement.

The holographic brain should visually appear to be formed from a dense collection of tiny illuminated dots, organised according to real anatomical geometry.

**Each primary interactive dot must represent a real note, AI conversation, document, meeting, or other meaningful stored knowledge item.**

A user clicking or selecting a dot must be able to discover what that memory contains.

Two distinct rendering layers are permitted:

**Layer A: Anatomical scaffold**

Noninteractive sampling points and subtle transparent geometry preserve the full anatomical shape, including before large amounts of data are imported.

**Layer B: Actual memory nodes**

Interactive, uniquely identifiable points represent real stored items. Their appearance and location reflect the semantic knowledge graph and assigned cerebral region.

These two layers must be visually distinguishable upon inspection.

Never populate the database with fake conversations to make the brain look full.

As more genuine information is imported, additional memory nodes should populate the brain.

A single conversation can be a primary node with nested message nodes, summaries, decisions and extracted insights accessible through progressive zoom.

A large archive should not result in millions of individually drawn dots. Use semantic clustering, hierarchical aggregation, instancing and level-of-detail rendering.

## 2.5 Fully interactive movement

The user must be able to:

- Rotate the brain freely
- Zoom in and out smoothly
- Pan and reposition the camera
- Double-click a region to focus
- Select individual memory nodes
- Highlight neighbouring neural connections
- Navigate from one connected memory to another
- Enter an immersive neural-network exploration mode
- Reset to the default brain orientation
- Search for a memory and fly the camera to its node
- Filter by source, category, topic, date and importance

Use damped camera controls and controlled transitions.

On mobile, provide equivalent touch controls and simplified rendering where needed.

## 2.6 Progressive zoom system

Implement three principal levels:

**Level 1: Whole-brain view**

The complete holographic brain appears, with visible colour-coded regions, memory density and major connections.

**Level 2: Regional exploration**

Zooming into a lobe reveals clusters grouped by topics, projects, people, conversations and other meaningful relationships.

**Level 3: Individual memories**

Zooming further reveals interactive memory points, their relationships, timestamps, summaries and source references.

When selecting a node, display the original material in a well-designed side panel or contextual overlay.

Do not force users to read dense paragraphs inside the 3D scene.

Provide a clear navigation trail back to the previous cluster or brain view.

---

# 3. NEURAL CONNECTIONS AND ASSOCIATIVE MEMORY

The system must organise knowledge in a graph rather than relying exclusively on folders.

## 3.1 Neural pathways

Memory nodes may connect through luminous filaments representing semantic or factual relationships.

Examples:

- Two conversations about the same business project
- A meeting discussing a previously proposed idea
- A document supporting an earlier decision
- A calendar event linked to meeting action items
- Different AI discussions concerning the same problem
- An insight that contradicts an older assumption

Connections should be created from evidence including:

- Semantic similarity
- Shared named entities
- Explicit references
- Shared projects
- Temporal context
- User-defined relationships
- Repeated concepts
- Cited source relationships

Do not create connections solely because two items are vaguely similar.

## 3.2 Neuroplasticity-inspired behaviour

The knowledge graph should evolve as information changes.

Implement:

- Automatic candidate relationship discovery
- Confidence scoring
- Importance ranking
- Relationship strengthening from repeated independent evidence
- Optional relevance decay for stale or weak associations
- User pinning of important relationships
- Manual connection and disconnection
- Explainable relationship descriptions
- Periodic rebuilding of semantic indices

Connection strength must not be treated as proof that a claim is true.

Avoid feedback loops that artificially strengthen incorrect relationships.

## 3.3 Neural animation

Neural pathways should glow subtly.

When the user retrieves information, the relevant nodes and links should illuminate sequentially, showing the route through the knowledge graph.

When the user asks a cross-domain question, related regions can illuminate in parallel.

Animation should represent actual retrieval activity where practical.

Do not falsely suggest that decorative neural activity represents a real biological or AI reasoning process.

Provide reduced-motion settings.

---

# 4. THE PERSISTENT MEMORY ENGINE

## 4.1 Supported memory sources

Support importing and organising:

1. ChatGPT conversations
2. Claude conversations
3. PDFs
4. Word documents
5. Plain-text and Markdown notes
6. Meeting recordings
7. Images and screenshots
8. Notion pages and databases
9. Google Drive documents
10. Gmail messages
11. Obsidian vaults
12. Websites and saved bookmarks

Build a modular ingestion system so additional integrations can be installed later.

## 4.2 Conversation imports

Preserve the original content and structure of imported AI conversations.

Where available, preserve:

- Conversation title
- Source provider
- Original conversation identifier
- Message ordering
- User messages
- Assistant messages
- Timestamps
- Model information
- Attachments and their references
- Tool-generated content when accessible
- Conversation branches when present
- Original export metadata

Build robust importers for the supported export formats.

Use official user-generated exports as the initial historical import mechanism.

Do not assume that OpenAI or Anthropic API keys grant access to a user's previous ChatGPT or Claude consumer conversations.

Do not scrape authenticated private chat interfaces, bypass access controls or misrepresent automatic synchronisation capabilities.

For future conversations, support conversations occurring directly inside this application, using authorised provider APIs.

Where supported official integrations permit additional synchronisation, make this an optional connector.

Clearly distinguish:

- Imported archive
- Connected source
- Live synchronisation
- One-time export
- Unsupported capability

## 4.3 Hierarchical memory structure

Maintain four complementary representations.

**Raw memory:** Immutable or versioned source content, complete and retrievable.

**Summary memory:** Concise summaries, detailed summaries and conversation-level summaries.

**Semantic memory:** Extracted facts, entities, topics, concepts and relationships, with confidence and source attribution.

**Active context:** A bounded selection of relevant information assembled for the user's current AI request.

Never replace original data with generated summaries.

## 4.4 Memory consolidation

Implement a background processing pipeline that can:

- Classify new information
- Extract factual claims
- Identify repeated ideas
- Detect potential contradictions
- Link related memories
- Produce structured summaries
- Update project-level summaries
- Identify decisions and action items
- Preserve historical changes to facts or opinions

Background processing jobs must be observable, retryable and idempotent.

The system should distinguish between historical statements and current knowledge.

Example:

An old conversation describes a business pricing model. A newer conversation changes that pricing model.

The system should retain both, identify the newer decision, and explain what changed.

Never silently overwrite history.

## 4.5 Memory search

Support:

- Keyword search
- Semantic vector search
- Hybrid search
- Metadata filters
- Graph traversal
- Date-range search
- Entity-based lookup
- Search across specific AI providers
- Search within individual projects
- Natural-language memory retrieval

Example queries:

"Find the conversation where we first discussed creating a holographic brain."

"What changed in my business strategy between April and October?"

"Show everything related to my latest product launch."

"Find the meeting where we agreed on the marketing plan."

Every retrieved answer must display its sources and provide navigation back to the original records.

---

# 5. PERSONAL AI INTELLIGENCE LAYER

## 5.1 Multi-model architecture

Support OpenAI and Anthropic through independent provider adapters.

The application should allow the user to:

- Select a preferred available GPT model
- Select a preferred available Claude model
- Switch models between tasks
- Ask the same question to multiple models
- Compare their responses
- Request synthesis of their findings
- Let one model critique another
- Save resulting conversations as new memories

Do not hardcode unavailable model names or assume particular subscription benefits.

Use currently supported provider APIs and a configurable model registry.

ChatGPT and Claude consumer subscriptions must not be assumed to include API credits.

## 5.2 Collaborative agent mode

Implement an optional mode in which two models can work together.

Suggested process:

1. User submits a task.
2. Relevant memories are retrieved.
3. Each selected model receives authorised, relevant context.
4. Models produce independent responses.
5. A comparison step identifies agreements, disagreements and missing evidence.
6. A synthesiser produces a consolidated answer.
7. The user can inspect the original model outputs.
8. Final results are stored in memory.

Avoid uncontrolled recursive agent loops.

Implement cost limits, token budgets, maximum iteration counts and cancellation.

Never describe this feature as two independently conscious entities.

## 5.3 AI assistant capabilities

The assistant should support:

- Knowledge retrieval
- Document analysis
- Conversation summarisation
- Idea generation
- Project planning
- Meeting analysis
- Task extraction
- Reminder suggestions
- Calendar assistance
- Historical comparisons
- Cross-source synthesis

The system should identify when it lacks sufficient evidence.

Do not invent forgotten conversations, missing documents or nonexistent commitments.

## 5.4 Voice interaction

Support natural voice conversations.

Include:

- Microphone permission controls
- Speech-to-text
- Streaming AI responses where supported
- Text-to-speech
- User interruption
- Conversation history
- Visible transcription
- Optional speech output
- Voice settings

Voice conversation should connect to the same memory retrieval system as text chat.

Audio must not be recorded outside explicit active sessions.

---

# 6. NOTION AI-INSPIRED MEETING INTELLIGENCE

This feature is a major product pillar.

Build a meeting assistant with a user experience comparable in purpose to Notion AI Meeting Notes.

Do not copy Notion's proprietary design.

## 6.1 Live transcription

The user should be able to click "New Meeting" and begin a transcription session.

Required features:

- Explicit start and stop
- Pause and resume
- Live transcript display
- Automatic scrolling
- Timestamps
- Speaker separation when technically supported
- Manual speaker renaming
- Recording duration
- Connection and microphone status
- Visible recording indicator
- Error recovery
- Draft preservation during interruptions

Use an appropriate streaming transcription service with documented language support.

Speaker diarisation quality must be evaluated and its limitations clearly communicated.

## 6.2 Capturing meeting audio

Support microphone audio as the baseline implementation.

Investigate browser-compatible tab or screen-audio capture where supported.

Some meeting configurations require desktop-level system-audio capture, particularly when participants use headphones.

Do not claim that a cloud-hosted website can capture arbitrary system audio on all operating systems.

If reliable desktop capture is necessary, design an optional authenticated desktop companion application.

Document browser and operating-system limitations.

## 6.3 Uploaded recordings

Allow users to upload recordings for transcription and summarisation.

Support common formats such as WAV, MP3, M4A and appropriate video containers where the processing pipeline permits them.

Include:

- Upload progress
- Processing status
- File-size and duration validation
- Speaker detection
- Time-aligned transcript
- Error handling
- Secure storage
- Configurable recording retention

## 6.4 AI meeting summaries

After a session, generate a structured meeting document containing:

**Overview**
A concise explanation of the meeting.

**Key discussion points**
The most important topics discussed.

**Decisions**
Explicit agreements and conclusions.

**Action items**
Tasks, responsible individuals and deadlines where actually stated.

**Unresolved questions**
Topics requiring further attention.

**Follow-ups**
Potential future actions requiring user confirmation.

**Full transcript**
The complete original transcript with timestamps.

The user should be able to edit, search, export and share notes intentionally.

Each summary claim should link back to its transcript span where possible.

## 6.5 Integration with the brain

Every meeting becomes a memory node.

Meeting topics, decisions and action items become linked subnodes or structured records.

The brain should automatically connect the meeting to relevant historical conversations and projects.

The user should be able to ask:

"What did we decide in yesterday's meeting?"

"Which action items are still outstanding?"

"Show me the earlier conversation that led to this meeting."

Meeting recording and transcription must be consent-based, with clear disclosure and applicable privacy controls.

---

# 7. CALENDAR, REMINDERS AND PERSONAL ORGANISATION

## 7.1 Google Calendar

Implement supported Google Calendar integration using OAuth.

Allow:

- Authorised account connection
- Calendar selection
- Viewing upcoming events
- Creating events with approval
- Editing events with approval
- Linking meetings to events
- Viewing linked notes
- Synchronising event metadata
- Managing time zones correctly

Request the minimum necessary scopes.

Do not perform calendar writes without explicit user authorisation.

## 7.2 Reminder engine

Build an internal reminder system supporting:

- Natural-language creation
- One-time reminders
- Recurring reminders
- Due dates
- Time zones
- Priority
- Completion status
- Browser or email notifications when enabled
- Optional Google Calendar event creation

Example:

"Remind me next Friday to review the project architecture."

The assistant should parse the request, clarify genuine ambiguities, confirm the intended reminder and save it persistently.

Use a reliable server-side scheduling mechanism rather than browser timers.

## 7.3 Action item intelligence

Meeting action items and conversation commitments should be suggested as possible tasks.

Do not automatically convert all extracted statements into reminders.

Provide an approval interface.

Tasks should link back to their source memory nodes.

---

# 8. EXTERNAL CONNECTIONS

Build an integration management page with clear status indicators.

## Notion
Use supported APIs to read authorised pages and databases.

## Google Drive
Use official OAuth scopes and APIs to access selected files.

## Gmail
Use supported Gmail APIs with narrowly scoped permissions. Allow searching or ingesting explicitly authorised email content.

## Obsidian
Implement Markdown vault import, including folder structure, links, tags and attachment references. Obsidian does not need to remain the user's main interface.

## Websites
Support user-submitted URLs, bookmarks and permitted content extraction. Respect access restrictions and source rights.

## Images
Store originals, relevant metadata and permitted text/visual descriptions. Keep extracted information linked to the original image.

Each connector must support error reporting, disconnection and relevant data deletion controls.

Importers should deduplicate records based on stable source identifiers or fingerprints.

Never fabricate successful syncs.

---

# 9. RECOMMENDED TECHNICAL ARCHITECTURE

Evaluate the current state of the repository first.

If it is empty, use this reference stack unless a demonstrably better current alternative exists.

**Frontend**
- TypeScript
- Next.js and React
- Tailwind CSS
- A disciplined, reusable UI component system

**3D rendering**
- Three.js
- React Three Fiber
- Drei
- Custom shaders where justified
- GPU instancing
- Adaptive level of detail
- WebGL compatibility with graceful fallbacks

**Backend**
- TypeScript server-side services
- Secure API routes or dedicated services where appropriate
- Background job infrastructure

**Storage**
- PostgreSQL
- pgvector
- Relational and graph-edge tables
- Private object storage
- Secure user authentication

**Deployment**
- Vercel where suitable
- Managed PostgreSQL/Supabase where suitable
- Dedicated worker services when workloads exceed serverless execution limits

**AI**
- OpenAI API adapter
- Anthropic API adapter
- Configurable embedding provider
- Transcription provider
- Text-to-speech provider

**Observability**
- Structured logs
- Import-job tracing
- Error monitoring
- Usage and cost monitoring
- Performance telemetry

Verify package compatibility, maintained versions and provider capabilities before implementation.

Do not choose an infrastructure component solely because it is popular.

---

# 10. DATABASE AND KNOWLEDGE GRAPH

Design a documented schema with appropriate migrations.

At minimum, model the following entities:

- Users
- Workspaces
- Provider connections
- Data sources
- Import jobs
- Documents
- Conversations
- Messages
- Attachments
- Memory nodes
- Memory node versions
- Memory edges
- Embedding records
- Categories and topics
- Entities and aliases
- Projects
- Meetings
- Transcript segments
- Speakers
- Decisions
- Action items
- Calendar events
- Reminders
- Agent runs
- Retrieval citations
- Audit events

## Memory nodes

Each node should include:

- Stable identifier
- Owner/workspace identifier
- Node type
- Source reference
- Title
- Summary
- Primary brain region
- Secondary categories
- Creation timestamp
- Source timestamp
- Importance score
- Processing status
- Semantic indexing status
- Visualisation coordinates
- Version metadata
- Privacy classification

## Graph edges

Each edge should include:

- Source node
- Target node
- Relationship type
- Evidence reference
- Confidence
- Strength
- Creation method
- Last validation time
- Manual override status

## Visual placement engine

Construct a mapping between semantic memory records and positions on the anatomical surface or defined internal neural layers.

Store stable spatial coordinates.

Use deterministic initial placement and collision-aware clustering.

Memory positions should not randomly change whenever the page reloads.

A new memory may create a node, update a cluster or introduce new links without unnecessarily reorganising the entire brain.

---

# 11. PERFORMANCE AND SCALABILITY

The application should work with a modest number of imported conversations and remain usable as the archive grows.

Target performance budgets:

- Smooth 3D navigation on a capable modern desktop
- Aim for 60 FPS during normal whole-brain navigation
- Graceful degradation on lower-powered devices
- No uncontrolled GPU memory growth
- Responsive node selection
- Efficient graph filtering
- Incremental loading
- Cancellable import jobs
- Paginated retrieval
- Adaptive bloom and particle-density controls

Test with:

- 100 memory nodes
- 1,000 memory nodes
- 10,000 memory nodes
- 100,000 stored records using aggregated visual representation

These are test datasets, not requests to invent permanent user memories.

Use benchmark fixtures isolated from production data.

Large archives must not require displaying every record as a separate draw call.

Implement automatic performance presets alongside manual graphics controls.

---

# 12. SECURITY, PRIVACY AND USER CONTROL

This application will potentially store highly personal information.

Security is a first-class requirement.

Implement:

- Authentication
- Secure session management
- Workspace-level data isolation
- Row-level security or equivalent enforced access control
- Encryption in transit
- Encryption at rest
- Secure provider token handling
- Secret management
- Restricted API keys
- Input validation
- Safe file processing
- Upload limits
- Malware-aware file handling
- Audit logging for sensitive actions
- Data export
- Data deletion
- Connection revocation
- Retention configuration
- Backup and recovery procedures

Review whether application-layer encryption is needed for especially sensitive content.

If such encryption is implemented, document its implications for server-side search, embeddings and model processing.

Never expose database service-role keys or provider API secrets to the browser.

Prevent prompt injection from imported web pages, emails and documents.

Imported content must be treated as untrusted source data, not as instructions to the agent.

Require explicit user approval before external actions such as sending email, editing calendar events or sharing information.

Clearly identify when data will be transmitted to an AI provider.

---

# 13. UI/UX REQUIREMENTS

The interface must be restrained, immersive and sophisticated.

## Main interface

The holographic brain dominates the screen.

Use minimal, discreet controls around the viewport.

Suggested layout:

**Top area**
- Application identity
- Global search
- Active model
- Connection status

**Central area**
- Immersive holographic brain
- Interactive memory points
- Neural pathways
- Selection highlights

**Left contextual navigation**
- Brain overview
- Memories
- Projects
- Meetings
- Calendar
- Integrations

**Right contextual panel**
- Selected memory
- Full content
- Related nodes
- Summary
- Original source
- Actions

**Bottom interaction area**
- AI conversation field
- Voice interaction control
- Model selection
- Context indicator

Panels should be collapsible.

The user must be able to hide nearly all interface controls and explore the brain without obstruction.

## Typography and materials

Use restrained modern typography.

Avoid oversized marketing headings, excessive glassmorphism, emoji decorations and generic SaaS card layouts.

Prefer:

- Precise spacing
- Subtle borders
- Fine scientific labels
- Dark translucent overlays
- Smooth transitions
- High contrast where needed
- Excellent readability
- Accessible keyboard navigation

## Visual quality restrictions

Do not create:

- A generic glowing sphere
- A simple particle blob
- A low-poly cartoon brain
- A random arrangement of neural lines
- A static brain image pretending to be interactive
- A network diagram masquerading as anatomy
- Empty placeholder panels
- Fake data presented as real memories
- Decorative buttons without functionality

The final application must convey technological sophistication through real structure, meaningful interaction and attention to detail.

---

# 14. CORE USER JOURNEYS

Implement and test these workflows.

## Journey A: Import AI history

1. User opens integrations.
2. Selects ChatGPT or Claude.
3. Receives accurate export instructions.
4. Uploads a supported archive.
5. Application validates and parses it.
6. Original conversations are preserved.
7. AI generates summaries and metadata.
8. Semantic index is updated.
9. Memory graph connections are generated.
10. New points become visible in the brain.
11. User zooms into a point and opens the original conversation.

## Journey B: Retrieve a forgotten conversation

1. User asks a natural-language question.
2. Hybrid search retrieves likely matches.
3. Results are reranked.
4. Relevant neural regions illuminate.
5. Camera focuses on the most relevant memory.
6. Assistant answers with source citations.
7. User opens the original conversation.
8. Related memories remain explorable.

## Journey C: Meeting intelligence

1. User starts a meeting session.
2. Audio permissions and consent notice appear.
3. Transcription begins.
4. Live words appear with timestamps.
5. User stops the session.
6. AI creates a structured summary.
7. Action items are extracted.
8. User approves any reminders.
9. Meeting becomes a memory node.
10. Relevant prior conversations become linked.

## Journey D: Collaborative AI reasoning

1. User asks a question.
2. Selects GPT and Claude.
3. Relevant memory context is retrieved.
4. Both providers analyse the task.
5. Differences are shown clearly.
6. A synthesised answer is generated.
7. The user can inspect evidence.
8. The resulting conversation is saved.
9. New memory links are created.

## Journey E: Voice-based reminder

1. User activates voice interaction.
2. User requests a reminder.
3. Speech is transcribed.
4. Assistant extracts date, time and task.
5. User confirms the reminder.
6. Reminder is stored and scheduled.
7. The assistant confirms the saved details.
8. A linked reminder node appears in the memory graph.

---

# 15. IMPLEMENTATION PHASES

Work in coherent, testable phases.

Do not attempt to implement every connector before the central interaction is reliable.

## PHASE 0 — Discovery and architecture

- Inspect repository
- Identify existing infrastructure
- Verify provider documentation
- Research anatomical datasets
- Assess licensing
- Document architecture
- Define database schema
- Establish design and performance budgets
- Identify external credentials needed

Deliver an architecture document and implementation plan.

## PHASE 1 — Anatomical hologram

This is the first major quality gate.

Build the interactive anatomical brain, including:

- Real anatomical mesh
- Four cerebral colour regions
- Transparent holographic rendering
- Anatomical dot scaffold
- Camera controls
- Immersive zoom
- Selection raycasting
- Performance presets

Verify anatomical quality before proceeding.

Do not compensate for poor geometry with more glow effects.

## PHASE 2 — Memory foundation

- Authentication
- Database migrations
- Private storage
- Memory data model
- Graph relationships
- Search foundations
- Real memory point rendering
- Memory detail panels
- Persistence across sessions

## PHASE 3 — Historical AI imports

- ChatGPT export importer
- Claude export importer
- Original conversation preservation
- Summarisation pipeline
- Categorisation
- Embeddings
- Duplicate detection
- Neural relationship generation

## PHASE 4 — Personal assistant

- GPT adapter
- Claude adapter
- AI chat
- Hybrid retrieval
- Source citations
- Multi-model comparison
- Collaboration workflow
- Voice input and output

## PHASE 5 — Meeting intelligence

- Live microphone transcription
- Recording uploads
- Speaker handling
- Summary generation
- Action item extraction
- Memory integration
- Consent and retention controls

## PHASE 6 — Productivity integrations

- Google Calendar
- Reminders
- Meeting/event linking
- Notion
- Google Drive
- Gmail
- Obsidian
- Image and document processing
- Web bookmarks

Implement each with appropriate permission boundaries and integration tests.

## PHASE 7 — Refinement and deployment

- Visual quality improvements
- Accessibility
- Mobile adaptation
- GPU optimisation
- Security review
- Error recovery
- Automated testing
- Monitoring
- Cloud deployment
- User documentation

---

# 16. STRICT ACCEPTANCE CRITERIA

Do not mark the overall system complete until the following can be demonstrated.

## Anatomical acceptance

- The model visibly resembles a medically accurate human brain.
- Major cortical folds are preserved.
- All four cerebral lobes are identifiable.
- Brain proportions and spatial relationships are plausible.
- The brain remains anatomically convincing when rotated.
- Transparent rendering reveals meaningful depth.
- Memory points do not obscure the anatomical structure.

## Interaction acceptance

- The brain rotates smoothly.
- Zoom and pan work.
- Users can select individual memories.
- Nodes open real information.
- Connections reveal meaningful relationships.
- Search can locate and focus a memory.
- The interface works with real imported content.

## Memory acceptance

- Original chats survive import.
- Conversation order is preserved.
- Summaries are linked to original records.
- Search returns relevant results.
- Results have source citations.
- Duplicate imports do not multiply records.
- Data persists after logout and login.
- Cross-device access works.

## AI acceptance

- GPT and Claude adapters work with valid credentials.
- Users can switch between available models.
- Responses use retrieved memory context.
- Sources can be inspected.
- Collaboration mode produces distinguishable model outputs.
- Errors and token costs are visible.

## Meeting acceptance

- Live transcription works on supported devices.
- Uploaded recordings can be processed.
- Transcript content is preserved.
- Summaries are generated from transcripts.
- Action items can be approved and stored.
- Recording permissions and consent are explicit.

## Security acceptance

- User data is isolated.
- Secrets never reach client bundles.
- Provider access is revocable.
- Imported content cannot issue privileged agent instructions.
- Destructive operations require confirmation.
- Export and deletion paths work.

## Engineering acceptance

- The app builds cleanly.
- Core tests pass.
- No critical runtime errors remain.
- Production deployment works.
- Environment setup is documented.
- Unsupported functionality is clearly identified.

---

# 17. VISUAL VERIFICATION AND ITERATION

Do not rely solely on generated code.

Where browser or screenshot tools are available:

1. Launch the application.
2. Render the holographic brain.
3. Capture screenshots from front, side and three-quarter views.
4. Compare the geometry against anatomical reference images.
5. Inspect whether the dot structure still preserves the brain silhouette.
6. Test the transparency and regional colours.
7. Test memory-point selection.
8. Test immersive zoom.
9. Review the interface at desktop and mobile sizes.
10. Fix visual defects and repeat.

A visually poor result is not complete simply because the build succeeds.

Use actual rendered screenshots to evaluate design quality.

Do not claim medical-grade anatomical accuracy without documenting the source geometry and the limitations of any anatomical validation performed.

---

# 18. DEVELOPMENT DISCIPLINE

Operate as an autonomous engineering agent within the permissions available.

You may inspect files, edit code, create components, run commands and execute tests using the provided development environment.

Before major modifications:

- Inspect existing code.
- Avoid destroying useful working functionality.
- Prefer incremental, reviewable changes.
- Keep database migrations reproducible.
- Document significant decisions.
- Maintain a clear implementation checklist.

If credentials, permissions or user-owned resources are missing, implement the supported architecture and state precisely what configuration is required.

Do not fabricate integrations, successful tests, connected accounts or production deployment.

Do not expose secrets in logs.

Do not create production reminders, calendar events or emails during testing without explicit authorisation.

Use isolated test data.

---

# 19. FIRST EXECUTION INSTRUCTIONS

Start by examining the repository and development environment.

Then:

1. Produce a concise technical architecture.
2. Identify a credible anatomical source asset and its licence.
3. Establish the application's database and authentication foundations.
4. Implement the initial brain renderer with actual anatomical geometry.
5. Apply the four-region holographic treatment.
6. Implement anatomical dot sampling separately from real memory nodes.
7. Add smooth camera interaction and regional exploration.
8. Create a persistent example memory through the real data layer, explicitly labelled as demonstration data.
9. Demonstrate that selecting the node opens its stored content.
10. Render and inspect the result.
11. Execute relevant tests and document outcomes.
12. Continue into the next development phase where access and execution budget permit.

Prioritise a working, anatomically convincing product foundation over a broad collection of superficial features.

**Do not stop after producing a plan. Implement the project.**

At the end of each meaningful execution phase, report:

- What is implemented
- What was tested
- Which requirements are satisfied
- What remains incomplete
- Which external integrations require credentials or permissions
- The next implementation milestone

Do not describe incomplete features as complete.

---

# 20. FINAL CREATIVE DIRECTION

Imagine a person opening their laptop and seeing a living, floating, transparent holographic representation of a real human brain.

Every luminous point represents a piece of their digital history.

Conversations, ideas, documents, meetings, images, decisions and personal knowledge are connected through glowing neural pathways.

They can rotate the brain, travel into its regions, inspect a forgotten conversation, discover connections between ideas, speak naturally to their AI assistant, and ask different AI models to reason over their accumulated knowledge.

As their digital history grows, the brain becomes richer and more connected.

It is not intended to simulate consciousness or reproduce actual biological brain function.

It is intended to be a visually meaningful, technically rigorous, deeply personal interface to accumulated knowledge.

**Build a real personal intelligence operating system that uses the human brain as both its anatomical visual language and its inspiration for associative memory.**

The design must never sacrifice anatomical fidelity, truthful functionality or user control for superficial futuristic effects.

This is the standard against which the entire project must be judged.

**BEGIN IMPLEMENTATION.**