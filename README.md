# Voice AI Journal for Obsidian

![Voice AI Journal Banner](https://raw.githubusercontent.com/tomorrowflow/obsidian-voice-ai-journal/main/assets/banner.png)

Voice AI Journal is a powerful Obsidian plugin that transforms your spoken words into structured journal entries using AI transcription and analysis. Record your thoughts, reflections, or ideas, and let the plugin convert them into beautifully formatted Markdown notes with intelligent summaries, insights, and visualizations.

## Features

### Voice Recording
- **Easy Recording Interface**: Start, pause, resume, and stop recordings with a simple interface
- **Recording Timer**: Keep track of your recording duration
- **Microphone Selection**: Choose from available microphones on your device
- **Mobile Support**: Full functionality on mobile devices

### AI-Powered Transcription
- **Multiple Transcription Options**: Use Obsidian's built-in AI providers or a local Whisper instance
- **Language Detection**: Automatic detection of the spoken language

### Intelligent Analysis
- **Smart Summaries**: AI-generated summaries of your recordings
- **Insightful Analysis**: Extract key insights and patterns from your spoken content
- **Automatic Titling**: Generate relevant titles for your journal entries
- **Mermaid Diagrams**: Create visual representations of your thoughts
- **Question Answering**: Identify and answer questions you ask during recordings

### Flexible Templates
- **Customizable Templates**: Create and edit templates for different types of journal entries
- **Template Editor**: Visual editor for managing your templates
- **Section Control**: Enable or disable specific sections based on your needs

### File Management
- **Organized Storage**: Automatically organize your recordings, transcripts, and journal entries
- **File Uploading**: Upload existing audio files for processing (desktop only)
- **Append to Notes**: Option to append new recordings to existing notes

## Getting Started

### Installation

1. Open Obsidian and go to Settings
2. Navigate to Community Plugins and disable Safe Mode
3. Click Browse and search for "Voice AI Journal"
4. Install the plugin and enable it

### Quick Start

1. Configure AI providers in Obsidian settings to do transcription and analysis
2. Click the microphone icon in the ribbon or use the command palette to start a recording
3. Speak clearly into your microphone
4. Click the stop button when finished
5. Configure processing options (template, save audio, etc.)
6. Wait for the plugin to process your recording
7. Review your new journal entry

## Configuration

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

## Using File Upload

On desktop devices, you can upload existing audio files for processing:

1. Open the recording modal by clicking the microphone icon
2. Click the "Upload Audio File" button at the bottom of the modal
3. Select an audio file from your computer
4. The plugin will process the file just like a recording

## Advanced Usage

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

## Troubleshooting

- **Microphone Access**: Ensure your browser/Obsidian has permission to access your microphone
- **Processing Errors**: Check console logs for detailed error messages
- **AI Provider Issues**: Verify your AI provider configuration in Obsidian settings

## Development

### Building from Source

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the plugin: `npm run build`
4. Copy the built files to your Obsidian plugins folder

### Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- Built with [Obsidian API](https://github.com/obsidianmd/obsidian-api)
- Uses [Obsidian AI Providers SDK](https://docs.obsidian.md/Plugins/AI/AI+providers)

---

Created by [Tomorrowflow](https://github.com/tomorrowflow)

