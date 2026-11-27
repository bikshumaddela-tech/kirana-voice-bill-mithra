# Kirana Voice Bill Mithra

Build a clean, mobile-friendly, voice-first web app called "Kirana Mithra" designed for Indian local grocery (Kirana) shopkeepers.

Core End-to-End Flow:
1. Header: Display the app name "Kirana Mithra" with a warm, trustworthy Indian retail theme (deep saffron/orange and forest green accents) and a language toggle for "Telugu (తెలుగు)" and "English".
2. Hero Voice Input: A large, prominent, pulsing Microphone button in the center with the label "Tap & Speak Items (మాట్లాడండి)".
3. Speech Recognition (No Secret Keys Needed): Use the browser's built-in Web Speech API (supporting 'te-IN' for Telugu and 'en-IN' for English) so it works immediately without any external API keys. Also include a "Try Sample Voice Command" demo button (with 2-3 clickable presets in Telugu/English like "2 kg Rice 120 rupees, 1 liter Sunflower Oil 150 rupees, 1 kg Sugar 45 rupees") in case the browser blocks mic permissions during testing.
4. Smart Item Parser & Live Bill Table: Automatically parse spoken/sample text into structured items (Item Name, Quantity, Price in ₹), add them to a live digital receipt table, calculate the Total Amount in ₹, and allow editing or deleting items.
5. Voice Confirmation & Checkout: Include a "Speak Bill Total (బిల్లు వినిపించు)" button using browser Text-to-Speech (speechSynthesis) that reads out the total amount, and a "Save & WhatsApp Receipt" button that saves the bill to a "Today's Sales / Khata" history tab and shows a formatted digital bill summary.

Keep the UI very simple, high-contrast, with large buttons suitable for busy shopkeepers.


Use code with caution.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://kirana-voice-bill-mithra.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/35f6da01-da9b-4236-aed6-d606e88f2929).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
