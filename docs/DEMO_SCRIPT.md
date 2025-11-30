# AceTime Demo Script

This guide walks through demonstrating AceTime's core features on TestFlight.

## Prerequisites

- Two iOS devices with AceTime installed via TestFlight
- Both devices connected to the internet
- Microphone and camera permissions granted

## Demo Flow

### 1. Registration (2 minutes)

**Device A (Host):**
1. Open AceTime app
2. Tap "Sign Up"
3. Enter name: "Alex Demo"
4. Enter email: "alex@demo.com"
5. Enter password: "demo123"
6. Tap "Create Account"
7. You should land on the Home screen

**Device B (Guest):**
1. Open AceTime app
2. Tap "Sign Up"
3. Enter name: "Jordan Demo"
4. Enter email: "jordan@demo.com"
5. Enter password: "demo123"
6. Tap "Create Account"

### 2. Start a Call (1 minute)

**Device A (Host):**
1. On Home screen, tap "Start New Call"
2. A room will be created with a 6-character code (e.g., "ABC123")
3. You'll see "Waiting for others to join..."
4. Tap "Share Invite" to share the room code

**Device B (Guest):**
1. On Home screen, tap "Join Call"
2. Enter the room code shared by Device A
3. Tap "Join Call"

### 3. Active Call Features (5 minutes)

Once both devices are connected:

1. **Video Call** - Both participants should see each other
2. **Live Transcript** - Start speaking naturally
   - Watch the transcript appear at the top of the screen
   - Try saying: "Let's discuss the product launch scheduled for next Tuesday"
   - Observe the <5 second latency

3. **AI Notes Panel** - Tap the "Notes" tab at the bottom
   - After ~30 seconds of conversation, AI notes will appear
   - Look for:
     - Summary of conversation
     - Key points
     - Action items
     - Suggested replies

4. **Call Controls** - Demonstrate:
   - Mute/unmute microphone (mic icon)
   - Turn camera on/off (camera icon)
   - Switch between Transcript and Notes tabs

### 4. Sample Conversation Script

Have the participants say these lines to generate good AI notes:

**Alex:** "Hi Jordan, let's go over the Q4 product launch plan."

**Jordan:** "Sure! I've been working on the marketing materials. The launch date is set for November 15th."

**Alex:** "Great. Can you make sure to send me the final designs by Friday?"

**Jordan:** "Absolutely. I'll also need you to review the press release draft."

**Alex:** "I'll do that by Wednesday. Should we schedule a follow-up meeting for Monday?"

**Jordan:** "Yes, let's do 2 PM. I'll send the calendar invite."

### 5. End Call (1 minute)

**Device A (Host):**
1. Tap the red end call button
2. Confirm "End Call"
3. Both devices will return to the home screen

### 6. View History (2 minutes)

**On either device:**
1. Tap "History" tab in the bottom navigation
2. Find the call you just completed
3. Tap on it to view:
   - Full transcript
   - AI-generated notes
   - Call duration
   - Participant list
4. Tap "Play Recording" to hear the audio

### 7. Settings Demo (1 minute)

1. Tap "Settings" tab
2. Show toggle options:
   - Microphone on by default
   - Camera on by default
   - Auto-record calls
3. Show account options:
   - Sign Out
   - Delete Account

## Key Points to Highlight

1. **Real-time Transcription** - Near-instant speech-to-text
2. **AI Intelligence** - Automatic notes without manual effort
3. **Privacy** - All data stored securely, deletable anytime
4. **Simplicity** - 6-character room codes, no accounts needed to join

## Troubleshooting

**Call won't connect:**
- Ensure both devices have internet
- Try creating a new room

**No transcript appearing:**
- Check microphone permissions
- Speak clearly and louder

**AI notes not updating:**
- Need at least 30 seconds of conversation
- Need at least 100 characters of transcript

## Demo Duration

Total time: ~12 minutes

- Registration: 2 min
- Call setup: 1 min
- Active call demo: 5 min
- End call: 1 min
- History review: 2 min
- Settings: 1 min

