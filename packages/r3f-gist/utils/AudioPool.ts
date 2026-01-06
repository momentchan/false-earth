interface AudioSource {
    range: [number, number];
    sources: string[];
}

interface AudioPoolOptions {
    poolSize?: number;
    random?: boolean;
}

/**
 * AudioPool - Manages a pool of Audio elements for efficient audio playback
 * Useful for playing multiple sounds without audio loading delays
 */
export default class AudioPool {
    private sourcesList: AudioSource[];
    private pool: HTMLAudioElement[];
    private id: number;

    constructor(
        sourcesList: AudioSource[], 
        { poolSize = 5, random = false }: AudioPoolOptions = {}
    ) {
        this.sourcesList = sourcesList;
        this.pool = [];
        this.id = 0;

        for (let i = 0; i < poolSize; i++) {
            const r = i / poolSize;

            let listId = 0;
            for (let j = 0; j < sourcesList.length; j++) {
                if (r >= sourcesList[j].range[0] && r < sourcesList[j].range[1]) {
                    listId = j;
                    break;
                }
            }
            const sources = sourcesList[listId].sources;

            const source = random 
                ? sources[Math.floor(Math.random() * sources.length)] 
                : sources[i % sources.length];
                
            const audio = new Audio(source);
            this.pool.push(audio);

            audio.addEventListener('loadeddata', () => {
                // Audio is fully loaded and ready to play
            });

            audio.addEventListener('error', (e) => {
                console.warn(`AudioPool: Failed to load audio source: ${source}`, e);
            });
        }
    }

    /**
     * Play an audio from the pool
     * @param volume - Volume level (0-1)
     * @returns Promise that resolves when audio starts playing
     */
    async playAudio(volume: number = 1): Promise<void> {
        const audio = this.pool[this.id];
        
        if (!(audio.ended || audio.paused)) {
            return; // Audio is still playing
        }

        audio.currentTime = 0;
        audio.volume = Math.max(0, Math.min(1, volume)); // Clamp volume between 0-1
        
        try {
            await audio.play();
        } catch (error) {
            console.warn('AudioPool: Failed to play audio:', error);
        }
        
        this.id = (this.id + 1) % this.pool.length;
    }

    /**
     * Stop all audio in the pool
     */
    stopAll(): void {
        this.pool.forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
        });
    }

    /**
     * Set volume for all audio in the pool
     */
    setVolume(volume: number): void {
        const clampedVolume = Math.max(0, Math.min(1, volume));
        this.pool.forEach(audio => {
            audio.volume = clampedVolume;
        });
    }

    /**
     * Get the number of audio elements in the pool
     */
    get poolSize(): number {
        return this.pool.length;
    }

    /**
     * Check if any audio is currently playing
     */
    get isPlaying(): boolean {
        return this.pool.some(audio => !audio.paused && !audio.ended);
    }
}
