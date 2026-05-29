import * as Speech from 'expo-speech';

export async function playWord(text: string): Promise<void> {
  await Speech.stop();
  Speech.speak(text, {
    language: 'en-US',
    rate: 0.9,
  });
}
