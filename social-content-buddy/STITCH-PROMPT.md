# PostAI — Full UI Rebuild Prompt (Light Theme)

> Use this prompt to rebuild the entire PostAI UI in Stitch. The app generates AI-powered Instagram post designs for businesses. Users bring their own GetLate.dev API key for social media publishing.

---

## Global Design Direction

**Theme:** Clean, modern LIGHT theme — white/gray backgrounds, subtle shadows, no dark mode
**Font:** Inter or Plus Jakarta Sans (400, 500, 600, 700)
**Accent Color:** Violet/Purple (#7C3AED primary, #8B5CF6 hover, #EDE9FE light bg)
**Border Radius:** 16px for cards, 12px for inputs/buttons, 8px for badges
**Shadows:** Soft shadows (0 1px 3px rgba(0,0,0,0.08)) on cards, no harsh borders
**Spacing:** Generous whitespace, 32px page padding, 24px card padding
**Icons:** Lucide React icon set throughout

**Color Tokens:**
- Page background: #FAFAFA or #F8FAFC (slate-50)
- Card background: #FFFFFF with subtle border (#E2E8F0)
- Text primary: #0F172A (slate-900)
- Text secondary: #64748B (slate-500)
- Text muted: #94A3B8 (slate-400)
- Accent: #7C3AED (violet-600)
- Accent light bg: #EDE9FE (violet-100)
- Success: #10B981 (emerald-500)
- Warning: #F59E0B (amber-500)
- Error: #EF4444 (red-500)
- Input border: #CBD5E1 (slate-300)
- Input focus ring: #7C3AED with 20% opacity

---

## App Structure

- **Auth pages** (Login, Signup) — full-screen centered card, no sidebar
- **Dashboard pages** — persistent left sidebar + main content area
- **Admin pages** — separate sidebar with admin-specific nav

---

## PAGE 1: Login (`/login`)

**Layout:** Full-screen white/light-gray background. Centered card (max-width 400px). Subtle decorative gradient blob in top-right corner (violet, very faint 5% opacity).

**Card Contents:**
1. **Logo:** Sparkles icon inside a violet circle badge (48px), centered
2. **App Name:** "PostAI" below logo, bold, large
3. **Title:** "Sign in" — text-xl font-semibold
4. **Subtitle:** "Enter your credentials to continue" — text-sm text-slate-500

5. **Form Fields:**
   - **Email** — label + input (placeholder: "you@example.com")
   - **Password** — label + input type=password (placeholder: "••••••••")

6. **Submit Button:** Full-width, violet background (#7C3AED), white text, "Sign in"
   - Loading state: spinner icon + "Signing in..."

7. **Footer Link:** "Don't have an account? **Sign up**" — link to /signup

**Input Style:** White background, slate-300 border, rounded-xl, h-10, focus ring violet

---

## PAGE 2: Signup (`/signup`)

**Layout:** Same as Login page. Card slightly wider (max-width 420px).

**Card Contents:**
1. **Logo + App Name:** Same as login
2. **Title:** "Create account"
3. **Subtitle:** "Invitation required to join"

4. **Info Banner:** Light violet background (violet-50), violet-700 border-left (4px), rounded-lg, padding 12px
   - Key icon + "You need an invitation code from an administrator to sign up."

5. **Form Fields:**
   - **Full Name** (required) — placeholder: "Jane Smith"
   - **Email** (required) — placeholder: "you@example.com"
   - **Password** (required) — placeholder: "At least 6 characters", minLength=6
   - **Invitation Code** (required) — placeholder: "XXXXXXXX", monospace font, uppercase auto-convert, letter-spacing wide

6. **Submit Button:** Full-width violet, "Create account"
   - Loading state: spinner + "Creating account..."

7. **Footer Link:** "Already have an account? **Sign in**" — link to /login

---

## PAGE 3: Dashboard Layout (wraps all `/dashboard/*` pages)

**Layout:** Flex row, full height

### Left Sidebar (width: 256px, white background, right border)

**Top Section:**
- Logo: Sparkles icon in violet badge (32px) + "PostAI" text (font-bold)
- Height 64px, bottom border

**Navigation Menu (vertical, gap-4px, padding 12px):**

| Label | Icon | Route |
|---|---|---|
| Dashboard | LayoutDashboard | /dashboard |
| Create Posts | PlusSquare | /create |
| History | History | /history |
| Settings | Settings | /settings |

- **Active state:** violet-50 background, violet-600 text, violet dot indicator on left edge
- **Inactive state:** slate-500 text, hover → slate-900 text + slate-100 bg
- Each item: rounded-lg, padding 8px 12px, font-medium text-sm

**Admin Divider (only if user.isAdmin):**
- Thin separator line
- "Admin Panel" nav item with Shield icon → /admin

**Bottom Section:**

**Credits Bar:**
- Card with slate-50 bg, rounded-xl, padding 16px
- Zap icon + "Credits" label
- Large number: credits remaining (font-bold text-2xl)
- Progress bar: h-2, slate-200 track, violet gradient fill
- "X of Y used" — text-xs slate-500

**User Info:**
- Avatar circle (40px): violet gradient bg, white initials
- Name (font-medium, truncated) + email (text-xs slate-500, truncated)
- Sign Out button: LogOut icon, text turns red on hover

### Main Content Area
- Background: #FAFAFA (slate-50)
- Padding: 32px
- Max-width: 1152px (6xl)
- overflow-y: auto

---

## PAGE 4: Dashboard (`/dashboard`)

**Header:**
- "Welcome back" — text-sm text-slate-500
- "FirstName" — text-2xl font-bold (no emoji)
- Right side: "New Batch" button (violet, PlusSquare icon) → links to /create

**Stats Row (2 cards, side by side):**

**Card 1 — Credits (spans full width on mobile, or 2/3):**
- White card, subtle shadow
- Zap icon in violet-100 circle
- "Credits" label (text-sm slate-500 uppercase)
- Large number: credits remaining (text-4xl font-bold)
- "remaining" subtitle
- Progress bar: h-2, slate-100 track, violet gradient fill, smooth animation
- "X of Y used · Z%" below

**Card 2 — Generated Posts:**
- TrendingUp icon in emerald-100 circle
- "Generated Posts" label
- Large number: total posts (text-4xl font-bold)
- "Total posts created"

**Recent Batches Section:**
- "Recent Batches" title + "View all →" link to /history (right-aligned)
- White card with list of recent batches (max 5)
- Each row:
  - Layers icon in small slate-100 circle
  - Business name (font-medium, truncated)
  - "3 posts · Mar 3" (text-sm slate-500)
  - Status dot (emerald for completed, amber pulse for generating, red for failed)
  - "View" ghost button on hover

**Empty State (when no batches):**
- Dashed border card (slate-200), centered content
- Image icon (large, slate-400)
- "Create your first batch" — font-semibold
- "Generate professional Instagram posts for your business" — text-sm slate-500
- "Get started" violet button → /create

---

## PAGE 5: Create Posts (`/create`)

This is a 3-step flow: **Form → Generating → Done**

### Step 1: Form

**Layout:** max-width 640px, centered

**Header:**
- "Create Posts" — text-2xl font-bold
- "Generate AI-powered Instagram posts for your business" — text-sm slate-500

**Card:**
- White card, subtle shadow, rounded-2xl, padding 24px

**Card Header:**
- Sparkles icon in violet-100 circle + "Business Details"
- "The more context you provide, the better the results" — text-xs slate-500

**Form Fields:**

1. **Business Name** (required, red asterisk)
   - Input, placeholder: "e.g. Bloom & Co Florist"

2. **Website URL** (optional)
   - Input with Globe icon prefix
   - Helper text below: "(optional — AI will read your site for context)"
   - Placeholder: "https://yourbusiness.com"

3. **Target Audience** (optional)
   - Textarea, 3 rows, Users icon
   - Placeholder: "e.g. Small business owners aged 25-45"

4. **Tone & Style** (optional)
   - Textarea, 3 rows, MessageSquare icon
   - Placeholder: "e.g. Bold and professional, or Warm and friendly"

5. **Number of Posts** (select dropdown)
   - Options: 1, 2, 3, 5, 10
   - Default: 3

**Submit Button:** Full-width violet, "Generate X Post(s)" with Sparkles icon
- Loading: spinner + "Generating briefs..."
- Disabled if business name empty

### Step 2: Generating

**Layout:** max-width 1024px

**Progress Card:**
- Loader spinner icon in violet-100 circle (spinning)
- "Generating posts..." — font-semibold
- "X of Y complete — this takes 30–60 seconds per image" — text-sm slate-500
- Progress bar: h-2, smooth animation, violet fill
- "X done" (left) + "X%" (right)

**Post Grid:**
- grid: 1 col mobile, 2 cols tablet, 3 cols desktop, gap-16px
- Each post: either skeleton shimmer (generating) or completed PostCard

### Step 3: Done

**Layout:** max-width 1024px

**Success Header:**
- CheckCircle icon in emerald-100 circle (emerald-500 icon)
- "X post(s) ready!" — font-semibold
- Business name + completion stats
- "Create more" ghost button with ArrowLeft icon

**Post Grid:** Same layout as generating step, all cards completed

**PostCard Component:**
- White card, rounded-2xl, subtle shadow
- **Image:** Square aspect ratio (1:1), rounded-xl top corners, object-cover
- **Hover overlay on image:** Semi-transparent dark overlay with "Download" button (centered)
- **Below image, padding 16px:**
  - **Hook Category:** Small badge (violet-100 bg, violet-700 text, rounded-lg) with Hash icon, monospace
  - **Caption:** The actual Instagram caption text (font-medium, text-sm, max 3 lines with clamp) — THIS IS NEW: each post now includes a real Instagram caption ready to copy
  - **Copy Caption button:** Small ghost button with Copy icon, shows "Copied!" briefly
  - **"Why this works"** — expandable section (click to toggle), small slate-500 text, chevron icon rotates on expand

**Footer:** "View all history" link → /history

---

## PAGE 6: History (`/history`)

**Header:**
- "History" — text-2xl font-bold
- "X batch(es) total" — text-sm slate-500
- "New Batch" button (violet) on the right

**Empty State:** Same pattern as dashboard empty state but with History icon and "No batches yet"

**Batches Table (white card):**

**Table Header Row:**
- Grid: Business (2fr) | Posts (80px) | Status (120px) | Date (120px) | Action (60px)
- Uppercase text-xs slate-400 font-medium

**Batch Rows:**
- Hover: slate-50 background
- **Business:** Layers icon + name (font-medium) + website URL below (text-xs slate-500)
- **Posts:** "3 posts" (text-sm)
- **Status Badge:**
  - Completed: emerald-100 bg, emerald-700 text, green dot
  - Generating: amber-100 bg, amber-700 text, amber pulsing dot
  - Pending: slate-100 bg, slate-600 text, gray dot
  - Failed: red-100 bg, red-700 text, red dot
- **Date:** "Mar 3, 2026" format (text-sm slate-500)
- **Action:** "View →" small ghost button

---

## PAGE 7: Settings (`/settings`)

**Layout:** max-width 640px

**Header:**
- "Settings" — text-2xl font-bold
- "Manage your account" — text-sm slate-500

### Card 1: Profile
- White card
- Header: User icon (violet) + "Profile"
- Content:
  - Large avatar (64px): violet gradient, white initials
  - Name (text-lg font-semibold) + admin badge if applicable
  - Email (text-sm slate-500)
- Separator
- Info rows (with dividers):
  - Full name
  - Email (with Mail icon)
  - Member since (with Calendar icon)
  - Account type (Administrator or Standard)

### Card 2: GetLate API Key — THIS IS NEW
- White card
- Header: Key icon (violet) + "Social Publishing"
- Description: "Connect your GetLate.dev account to publish posts directly to Instagram, Twitter, LinkedIn, and 10+ other platforms."
- **"Get your free API key" link** → opens https://getlate.dev in new tab
- **API Key Input:**
  - Label: "Your GetLate API Key"
  - Input type=password, placeholder: "sk_..."
  - Show/hide toggle button (Eye/EyeOff icon)
  - Helper text: "Your key is encrypted and stored securely. Free tier: 20 posts/month."
- **"Save Key" button** (violet) — saves encrypted key to user's profile
- **Connection Status** (shows after key is saved):
  - If valid: Green badge "Connected" with CheckCircle icon + "X posts remaining this month"
  - If invalid: Red badge "Invalid key" with XCircle icon
- **"Remove Key" button** (ghost, red text) — appears only when key is saved
- **Connected Accounts Section** (shows after valid key):
  - List of connected social accounts from Late API
  - "Connect new account" button → initiates Late OAuth flow for a platform
  - Each connected account shows: platform icon + username + "Disconnect" option

### Card 3: Credits
- Same as current (progress bar, breakdown table)
- But with light theme colors (slate-100 track, violet fill)

### Card 4: Account
- Invitation code used (monospace, slate-100 bg)
- User ID (monospace, text-xs)

---

## PAGE 8: Admin Layout (wraps `/admin/*`)

**Layout:** Flex row, full height

### Left Sidebar (width: 240px, white bg, right border)

**Header:**
- Sparkles icon in purple badge + "SPA"
- "Admin Panel" badge: red-100 bg, red-600 text, Shield icon

**Navigation:**
| Label | Icon | Route |
|---|---|---|
| Overview | LayoutDashboard | /admin |
| Users | Users | /admin/users |
| Invitation Codes | Ticket | /admin/codes |
| Posts | Image | /admin/posts |

- Active: violet-50 bg, violet-600 text
- Inactive: slate-500, hover → slate-900

**Bottom:**
- "← Dashboard" link → /dashboard
- "Sign out" button (red on hover)

---

## PAGE 9: Admin Overview (`/admin`)

**Header:**
- "Admin Overview" — text-2xl font-bold
- "Platform-wide statistics and activity" — slate-500

**Stats Grid (3 columns, 2 rows = 6 cards):**

Each card: white bg, subtle shadow, rounded-2xl, padding 20px
- Icon in colored-100 circle (48px)
- Label: uppercase text-xs slate-400
- Value: text-3xl font-bold
- Optional sub-text: text-xs slate-500

| Stat | Icon | Color |
|---|---|---|
| Total Users | Users | blue |
| Total Batches | Layers | purple |
| Total Posts Generated | Image | emerald |
| Posts Today | Calendar | amber |
| Posts This Week | TrendingUp | cyan |
| Total Credits Consumed | Zap | orange |

**Recent Users Card:**
- Table with columns: User (avatar + name + email) | Credits Used (X/Y) | Credits Left | Joined
- Subtle row borders, hover highlight

---

## PAGE 10: Admin Users (`/admin/users`)

**Header:**
- "Users" + "X registered user(s)"

**Users Table Card:**
- Columns: User | Credits | Usage | Admin | Joined | Actions

**Row Content:**
- **User:** Avatar (40px, violet gradient) + Name + Email
- **Credits:** "X/Y" format + remaining count
- **Usage:** Progress bar (h-1.5) + percentage
- **Admin:** Badge "Admin" (violet-100, violet-700) or "User" text
- **Joined:** Date formatted
- **Actions:**
  - Toggle Admin: Shield/ShieldOff icon button
  - Edit Credits: Opens dialog

**Edit Credits Dialog:**
- White modal with overlay
- Shows user info (name, email, current credits)
- Number input for new credits limit (0-9999)
- Cancel + Save buttons

---

## PAGE 11: Admin Invitation Codes (`/admin/codes`)

**Header:**
- "Invitation Codes"
- "X total · Y active · Z used"

**Generate Section (white card):**
- "Generate New Codes" with Plus icon
- Number input (1-50) + "Generate" button (violet)
- After generation: grid of code buttons (monospace, copy on click)
- "Copy all" button

**All Codes Table (white card):**
- Columns: Code | Status | Used By | Used At | Created | Actions
- **Code:** Monospace + copy button
- **Status badges:**
  - Used: slate-100 bg, slate-600 text
  - Active: emerald-100 bg, emerald-700 text
  - Inactive: red-100 bg, red-600 text
- **Deactivate button:** XCircle icon, red text (only for active codes)

---

## PAGE 12: Admin Posts (`/admin/posts`)

**Header:**
- "Posts"
- Stats line: "X total batches · Y completed · Z failed · W in progress" (colored text for each)

**Table (white card):**
- Columns: Business | User | Posts | Status | Created | Completed
- **Business:** Image icon + name + website URL
- **User:** Name + email
- **Status Badge:** Same as History page badges
- **Dates:** Date + time below

---

## Key New Features to Include

### 1. BYOK (Bring Your Own Key) — GetLate API
- Users go to https://getlate.dev, create a free account, get their API key
- They paste the key into Settings → Social Publishing card
- Key is stored encrypted in the database per user
- When posting, the app uses THEIR key to call Late's API
- Free tier gives them 20 posts/month (no cost to you)

### 2. Instagram Captions on Every Post
- Each generated post now includes a ready-to-use Instagram caption
- The caption is generated alongside the design brief by the AI
- Shown below the image on the PostCard
- Has a "Copy" button to copy caption to clipboard
- Caption should be platform-ready (with hashtags, emojis, call-to-action)

### 3. Publish Flow (on completed posts)
- Each PostCard gets a "Publish" button (only if user has Late API key saved)
- Clicking "Publish" opens a small modal:
  - Shows the image preview + caption (editable textarea)
  - Platform selector: checkboxes for connected accounts (Instagram, Twitter, etc.)
  - "Schedule" option with datetime picker OR "Publish Now"
  - "Publish" button → calls Late API to create post
- Status updates on the card after publishing (Published badge with timestamp)

---

## Component Library

Use these component patterns consistently:

**Card:** `bg-white rounded-2xl border border-slate-200 shadow-sm p-6`
**Input:** `bg-white border border-slate-300 rounded-xl h-10 px-3 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500`
**Button Primary:** `bg-violet-600 hover:bg-violet-500 text-white rounded-xl h-10 px-4 font-medium shadow-sm`
**Button Ghost:** `text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl h-10 px-4`
**Badge:** `inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg`
**Avatar:** `rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-white flex items-center justify-center font-semibold`
**Progress Bar:** `h-2 bg-slate-100 rounded-full overflow-hidden` → fill: `bg-gradient-to-r from-violet-600 to-violet-400`
**Table Row:** `hover:bg-slate-50 transition-colors`
**Separator:** `h-px bg-slate-100`
**Label:** `text-sm font-medium text-slate-700`
**Helper Text:** `text-xs text-slate-500 mt-1`

---

## Responsive Breakpoints

- **Mobile (<640px):** Single column, full-width cards, sidebar hidden (hamburger menu)
- **Tablet (640-1024px):** 2-column grids, sidebar visible
- **Desktop (>1024px):** 3-column grids for posts, full table views
