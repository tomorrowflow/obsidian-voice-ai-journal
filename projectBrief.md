# Project Brief: Voice AI Journal for Obsidian

## Project Overview

**Voice AI Journal** is an Obsidian plugin that transforms spoken words into structured journal entries using AI transcription and analysis. The plugin enables users to record their thoughts, reflections, or ideas through voice and automatically converts them into beautifully formatted Markdown notes with intelligent summaries, insights, and visualizations.

## Main Goal & Purpose

The primary goal is to streamline the journaling process by eliminating the friction of manual typing, making it easier for users to capture their thoughts spontaneously through voice recording. The plugin leverages AI to not only transcribe speech but also analyze and structure the content into meaningful journal entries.

## Key Features & Components

### Voice Recording Capabilities
- **Easy Recording Interface**: Start, pause, resume, and stop recordings with intuitive controls
- **Recording Timer**: Real-time tracking of recording duration
- **Microphone Selection**: Support for multiple microphone devices
- **Cross-Platform Support**: Full functionality on both desktop and mobile devices
- **File Upload**: Process existing audio files (desktop only)

### AI-Powered Transcription
- **Multiple Transcription Options**: 
  - Obsidian's built-in AI providers
  - Local Whisper instance support
- **Language Detection**: Automatic detection of spoken language
- **Multi-language Support**: Configurable transcription and output languages

### Intelligent Analysis & Processing
- **Smart Summaries**: AI-generated summaries of recordings
- **Insightful Analysis**: Extract key insights and patterns from spoken content
- **Automatic Titling**: Generate relevant titles for journal entries
- **Mermaid Diagrams**: Create visual representations of thoughts and concepts
- **Question Answering**: Identify and answer questions posed during recordings

### Template System
- **Customizable Templates**: Create and edit templates for different journal entry types
- **Visual Template Editor**: User-friendly interface for template management
- **Section Control**: Enable/disable specific sections based on user needs
- **Default Template**: Pre-configured template with summary, insights, charts, and Q&A sections

### File Management & Organization
- **Structured Storage**: Organized file system for recordings, transcripts, and journal entries
- **Configurable Locations**: Separate folder settings for different file types
- **Markdown Integration**: Seamless integration with Obsidian's note system
- **Append Functionality**: Option to append new recordings to existing notes

## Target Audience

### Primary Users
- **Digital Journalers**: Individuals who maintain regular digital journals and want to streamline their workflow
- **Busy Professionals**: People who want to capture thoughts quickly without interrupting their workflow
- **Content Creators**: Writers, researchers, and creators who need to capture ideas on-the-go
- **Accessibility Users**: Individuals who prefer or require voice input over typing

### Secondary Users
- **Students**: For capturing lecture notes, study reflections, or research thoughts
- **Therapists/Coaches**: Professionals who want to record session notes or personal reflections
- **Language Learners**: Users practicing speaking in different languages with transcription feedback

## Technical Architecture

### Core Technologies
- **TypeScript**: Primary development language for type safety and maintainability
- **Obsidian API**: Deep integration with Obsidian's plugin ecosystem
- **esbuild**: Fast bundling and compilation
- **Web Audio API**: Browser-based audio recording capabilities

### Key Architectural Components

#### Audio Processing Layer
- [`AudioManager.ts`](src/audio/AudioManager.ts): Core audio handling and device management
- [`AudioRecorder.ts`](src/audio/AudioRecorder.ts): Recording functionality and audio capture
- [`RecordingManager.ts`](src/recording/RecordingManager.ts): State management for recording sessions

#### AI Integration Layer
- [`AIManager.ts`](src/ai/AIManager.ts): Central AI provider management and text analysis
- [`ASRManager.ts`](src/ai/ASRManager.ts): Automatic Speech Recognition coordination
- **Obsidian AI Providers SDK**: Integration with Obsidian's AI ecosystem

#### Template & Content Processing
- [`TemplateManager.ts`](src/templates/TemplateManager.ts): Template system management
- [`audioProcessingUtils.ts`](src/utils/audioProcessingUtils.ts): Content processing workflows
- [`titleGenerator.ts`](src/utils/titleGenerator.ts): AI-powered title generation

#### User Interface Layer
- [`RecordingModal.ts`](src/ui/modals/RecordingModal.ts): Main recording interface
- [`TemplateEditorModal.ts`](src/ui/TemplateEditorModal.ts): Template management UI
- **Settings Tabs**: Comprehensive configuration interface

#### File & Storage Management
- [`FileService.ts`](src/services/FileService.ts): Vault file operations
- [`fileStoreUtils.ts`](src/utils/fileStoreUtils.ts): Structured file organization
- [`storeTranscriptAsMarkdown.ts`](src/utils/storeTranscriptAsMarkdown.ts): Transcript storage

### External Dependencies
- **@obsidian-ai-providers/sdk**: AI provider integration
- **Local Whisper Support**: Optional local transcription server
- **Obsidian Plugin API**: Core platform integration

## Development & Deployment

### Build System
- **Development**: `npm run dev` with hot reloading via esbuild
- **Production**: `npm run build` with TypeScript compilation and optimization
- **Version Management**: Automated version bumping with git integration

### Code Quality
- **TypeScript**: Strict type checking and modern ES features
- **ESLint**: Code quality and consistency enforcement
- **EditorConfig**: Consistent formatting across development environments

## Project Structure Philosophy

The project follows a modular architecture with clear separation of concerns:
- **Domain-driven organization**: Features grouped by functionality (ai/, audio/, templates/, etc.)
- **Utility-first approach**: Shared utilities for common operations
- **Plugin-centric design**: Built specifically for Obsidian's ecosystem and conventions
- **Extensible template system**: Flexible content generation framework

## Future Extensibility

The architecture supports future enhancements such as:
- Additional AI provider integrations
- Custom analysis workflows
- Advanced template features
- Multi-modal input support (text + voice)
- Collaborative journaling features
- Integration with other Obsidian plugins

This project represents a sophisticated integration of modern web technologies, AI capabilities, and user experience design, specifically tailored for the Obsidian knowledge management ecosystem.