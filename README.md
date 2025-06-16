# Voice AI Journal for Obsidian 🎙️

Transform your voice into insights with Voice AI Journal, an Obsidian plugin that not only records your voice and transcribes it, but also summarizes and enriches your notes with the power of AI. Dive into a seamless experience where your spoken words are effortlessly converted into a structured, easy-to-navigate knowledge base.

**Attention, this plugin is not published yet. You need to clone the repository and install it manually to test it.**

## 🌟 Key Features

### Voice-to-Text Magic
- **Easy Recording Interface**: Start, pause, resume, and stop recordings with a simple interface
- **Recording Timer**: Keep track of your recording duration
- **Microphone Selection**: Choose from available microphones on your device
- **Mobile Support**: Full functionality on mobile devices
- **File Upload**: Process existing audio files (desktop only)

### Robust Transcription and Analysis
- **Multiple Transcription Options**: Use Obsidian's built-in AI providers or a local Whisper instance
- **Language Detection**: Automatic detection of the spoken language
- **Multi-language Support**: Configurable transcription and output languages
- **Smart Summaries**: AI-generated summaries of your recordings
- **Insightful Analysis**: Extract key insights and patterns from your spoken content

### Interactive and Visual
- **Automatic Titling**: Generate relevant titles for your journal entries
- **Mermaid Diagrams**: Create visual representations of your thoughts and concepts
- **Question Answering**: Identify and answer questions you ask during recordings
- **Interactive Queries**: Ask questions mid-recording, and get answers integrated into your notes

### Flexible Templates
- **Customizable Templates**: Create and edit templates for different types of journal entries
- **Visual Template Editor**: User-friendly interface for template management
- **Section Control**: Enable or disable specific sections based on your needs
- **Default Template**: Pre-configured template with summary, insights, charts, and Q&A sections

### Reliable File Management
- **Organized Storage**: Automatically organize your recordings, transcripts, and journal entries
- **File Uploading**: Upload existing audio files for processing (desktop only)
- **Append to Notes**: Option to append new recordings to existing notes
- **Configurable Locations**: Separate folder settings for different file types
- **Progressive Saving**: Designed with mobile users in mind, ensuring no step is a single point of failure

## 📸 Screenshots

(... will follow)

## 🚀 Getting Started

### Installation

1. In Obsidian, navigate to `Settings` > `Community Plugins`.
2. Search for `Voice AI Journal` and click `Install`.
3. Once installed, toggle `Enable` to activate the plugin.

### Quick Start

1. Configure AI providers in Obsidian settings to do transcription and analysis.
2. Click the microphone icon in the ribbon or use the command palette to start a recording.
3. Speak clearly into your microphone.
4. Click the stop button when finished.
5. Configure processing options (template, save audio, etc.).
6. Wait for the plugin to process your recording.
7. Review your new journal entry.

## 🕹️ Commands

### From the Ribbon button
- Click the microphone icon to open the recording modal

### From the Command Palette
Type "Voice AI Journal" to see available commands:
- **Begin Recording**: Opens the recording modal for you to start recording
- **Transcribe & Summarize Current File**: Run this on an open audio file - it will process this file
- **Fix Mermaid Chart**: Sometimes the generated Mermaid Chart is invalid, this will attempt to fix it

## ⚙️ Settings / Config

### General Settings

- **Transcription Provider**: Choose between Obsidian AI Providers or Local Whisper
- **Audio Quality**: Select the quality level for recordings
- **Transcription Language**: Set a specific language or use auto-detection
- **Output Language**: Choose the language for AI-generated content
- **Note Location**: Set where journal entries are saved
- **Transcripts Location**: Set where raw transcripts are saved
- **Recordings Location**: Set where audio recordings are saved

### Templates

The plugin comes with a default template that includes:

1. **Summary**: A concise summary of your recording
2. **Insights**: Key insights extracted from your content
3. **Mermaid Chart**: A visual representation of concepts and relationships
4. **Answered Questions**: Responses to questions you asked during recording

You can customize these sections or create entirely new templates through the Template Editor.

### AI Provider Configuration

- **OpenAI API Key (Required)**: Essential for transcription and summarization. Set your key in the `Settings`.
- **Local Whisper Setup**: If you prefer to use a local Whisper instance for transcription:
  1. Set up a Whisper API server on your local machine
  2. In plugin settings, select "Local Whisper" as your transcription provider
  3. Enter the endpoint URL (default: http://localhost:9000)

## 📖 How to Use

1. **Start Recording**: Trigger the Voice AI Journal action or select it from the ribbon and begin recording.
2. **Interactive Queries**: Pose questions during recording to have them answered and integrated into your notes just say "Hey Voice AI Journal" followed by the question.
3. **Review and Explore**: Access the transcribed text, summary, insights, and Mermaid charts directly in your note.

## 📱 Mobile Usage

Voice AI Journal shines in mobile scenarios, gracefully handling interruptions or connectivity issues. If any step fails, simply resume without losing any progress. This is a work in progress, you will never lose your audio, but it will regenerate the note, transcription and summary.

### Known Issues

1. On iOS, the screen must be **ON** while recording otherwise it won't capture your voice. This is a limitation of Obsidian.

## 📤 Using File Upload

On desktop devices, you can upload existing audio files for processing:

1. Open the recording modal by clicking the microphone icon
2. Click the "Upload Audio File" button at the bottom of the modal
3. Select an audio file from your computer
4. The plugin will process the file just like a recording

## 🛠️ Advanced Usage

### Local Whisper Setup

If you prefer to use a local Whisper instance for transcription:

1. Set up a Whisper API server on your local machine
2. In plugin settings, select "Local Whisper" as your transcription provider
3. Enter the endpoint URL (default: http://localhost:9000)

### Custom Templates

Create specialized templates for different types of journal entries:

1. Go to the Template Editor
2. Click "Add New Template"
3. Configure sections with custom prompts
4. Save and select your template when processing recordings

## 🛠️ How to Contribute

Your insights, improvements, and feedback are what make Voice AI Journal better. Feel free to submit issues, pull requests, or suggestions to enhance the plugin further.

## 🙏 Acknowledgements

A deep bow, acknowledgement and gratitude to the innumerable nameless humans from Colombia to the Philippines to Kenya and beyond who used their intelligence and human hearts to help train what we are calling artificial intelligence.

- [The Exploited Labor Behind Artificial Intelligence](https://www.noemamag.com/the-exploited-labor-behind-artificial-intelligence/)
- [Millions of Workers Are Training AI Models for Pennies](https://www.wired.com/story/millions-of-workers-are-training-ai-models-for-pennies/)

A special thanks to:
- [Drew Mcdonald of the Magic Mic Plugin](https://github.com/drewmcdonald/obsidian-magic-mic) for learning how to access & use the audio buffers
- [Mossy1022 of the Smart Memos Plugin](https://github.com/Mossy1022/Smart-Memos) for the idea of including Mermaid Charts

## 🔒 License

Voice AI Journal is released under the MIT License. Feel free to use, modify, and distribute it as you see fit.

## ❓ FAQ

**Q: Do I need both OpenAI and AssemblyAI keys?**
A: An OpenAI key is essential for transcription and summarization. The AssemblyAI key is optional but provides enhanced transcription accuracy.

**Q: Can I use Voice AI Journal on mobile devices?**
A: Yes, Voice AI Journal has full functionality on mobile devices. It's designed to handle interruptions and connectivity issues gracefully.

**Q: What happens if a step fails during processing?**
A: If any step fails, you can simply resume the process without losing any progress. The plugin will regenerate the note, transcription, and summary.

## 📬 Contact

Got questions, feedback, or ideas? Reach out through [GitHub Issues](#) or join our Discord channel to become part of the Voice AI Journal community.

## 📤 Troubleshooting

- **Microphone Access**: Ensure your browser/Obsidian has permission to access your microphone
- **Processing Errors**: Check console logs for detailed error messages
- **AI Provider Issues**: Verify your AI provider configuration in Obsidian settings

## 💻 Development

### Building from Source

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the plugin: `npm run build`
4. Copy the built files to your Obsidian plugins folder

---

Created by [Tomorrowflow](https://github.com/tomorrowflow)
