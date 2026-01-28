# 🧠 CoDified: A Better Memory for Your AI

Let's be honest: talking to AI can be frustrating.

One minute, you're having a brilliant brainstorming session with Claude. You close the tab, come back an hour later, and... blank stares. It's forgotten everything. We call it **AI Amnesia**, and it happens because AI has a very short memory.

Then there's the **Context Overload**. You try to paste your whole project into the chat so it "understands," and you get hit with an error message saying "Too much text!". Or worse, the model gets confused and starts making things up.

And don't get me started on the **"Separate Islands" (Silos)** problem. You use one AI for planning and another for coding, but they can't talk to each other. It's like having two employees who work in different buildings and never speak. You end up being the messenger running back and forth between them.

**CoDified fixes this.**

It gives your AI agents a persistent, shared memory. Think of it less like a complex database and more like a **Central Librarian** for all your digital tools.

---

## 🛠️ How It Actually Works (The "Secret Sauce")

We built a few specific things to make this usable for real work, explained simply:

### 1. It Finds the *Right* Needle in the Haystack 🪡
Most memory tools just look for matching words. CoDified is smarter.
It uses a **Hybrid Index**. Think of it like a librarian who knows both the *title* of the book (Keywords) and what the book is actually *about* (Meaning).
*   *Example: If you ask about "The login bug," it knows to look at the `login.js` file, even if you didn't say the exact filename.*

### 2. It Doesn't Forget When You Blink 🛡️
We built a safety net called an **Active State Machine**. Imagine you are writing a letter and your pen runs out of ink. Instead of throwing the letter away, CoDified marks it as "Paused". When you get a new pen (or restart the server), it picks up exactly where it left off. No thoughts are lost.

### 3. It Plays Nice with Everyone 🤝
This is the big one. We use a universal standard called **MCP**.
This means **Claude**, **Cursor**, **Gemini**, and your other tools can *all* read from the same memory. You can start a plan in one tool and finish it in another, and they'll both know what's going on.

### 4. It's Safe (Because The Internet is Scary) 🔒
We scrub everything. If an AI tries to accidentally save something dangerous (like a computer virus script), our **Sanitizer** cleans it up before it gets stored. It's like washing your hands before touching the food.

---

## 🏗️ The Architecture (Visualized)

Here's a simple picture of how it works. CoDified sits in the middle, listening to your tools and organizing their thoughts into long-term storage.

![System Architecture Diagram](/C:/Users/Bindesh%20Kandel/.gemini/antigravity/brain/979772a2-9857-4e57-9816-8467ec0195db/codified_architecture_diagram_1769621348313.png)

**The Loop is simple:**
1.  **You speak**: "Hey, remember that API key logic we discussed?"
2.  **It listens**: CoDified grabs that text.
3.  **It thinks**: "Okay, that's an important fact about Security."
4.  **It saves**: It files it away permanently.
5.  **It remembers**: Next week, when you ask "How do we handle login?", it pulls that exact fact back up.

---

## ❤️ Why This Actually Matters for You (The Human)

We built this for AI, but really, we built it for *you*. Here is how it makes your life better:

### 1. You Don't Have to Be a "Copy-Paste Robot" 🧘
Stop wasting time scrolling up 500 messages to find that one code snippet to paste into a new chat. Your AI already knows it. You can spend that energy on actual thinking.

### 2. You Can Finally Do "Deep Work" 🕯️
Real projects take weeks, not minutes. CoDified lets you pick up a project after a month away and instantly get back in the flow. The AI remembers exactly where you left off, so you don't have to re-explain the whole plan.

### 3. Your Creativity Doesn't Get Interrupted 🎨
Want to use Gemini to write a story but Claude to edit it? Go for it. You don't have to manually transfer the context. Just switch tools and keep creating. No friction.

---

## 🚀 Getting Started

Honest warning: this is a local-first tool. No cloud, no subscriptions, but you do need to run it on your own computer.

### Prerequisites
*   Node.js v18+ (A common software for running apps)
*   A computer (Windows, Mac, or Linux)

### Installation
1.  Download the code.
2.  Open your terminal (command prompt) in the folder.
3.  Run this command to install the parts:
    ```bash
    npm install
    ```

### Running It
We made a special launcher script to keep things clean. Run this:
```bash
node mcp-server.js
```

### Hooking it up to Claude
You just need to tell Claude where to find the server. Add this to your config file:

`%APPDATA%\Claude\claude_desktop_config.json`
```json
{
  "mcpServers": {
    "CoDified": {
      "command": "node",
      "args": ["C:\\path\\to\\CoDified\\mcp-server.js"]
    }
  }
}
```

And that's it! Restart Claude, and you've got a persistent memory engine ready to go. Happy coding! 🎉
