/**
 * Format milliseconds as MM:SS.ms
 * @param ms Milliseconds to format
 * @returns Formatted time string (MM:SS.ms)
 */
export function formatRecordingTime(ms: number): string {
    if (ms < 0) {
        ms = 0;
    }
    
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10); // Get hundredths of a second
    
    // Zero-pad the values
    const minutesStr = minutes.toString().padStart(2, '0');
    const secondsStr = seconds.toString().padStart(2, '0');
    const millisecondsStr = milliseconds.toString().padStart(2, '0');
    
    return `${minutesStr}:${secondsStr}.${millisecondsStr}`;
}
