export interface PasswordOptions {
  length: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
}

const UPPERCASE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE_CHARS = "abcdefghijklmnopqrstuvwxyz";
const NUMBER_CHARS = "0123456789";
const SYMBOL_CHARS = "!@#$%^&*()_+~`|}{[]:;?><,./-=";

export function generatePassword(options: PasswordOptions): string {
  let charset = "";
  const guaranteedChars: string[] = [];

  if (options.includeUppercase) {
    charset += UPPERCASE_CHARS;
    guaranteedChars.push(getRandomChar(UPPERCASE_CHARS));
  }
  if (options.includeLowercase) {
    charset += LOWERCASE_CHARS;
    guaranteedChars.push(getRandomChar(LOWERCASE_CHARS));
  }
  if (options.includeNumbers) {
    charset += NUMBER_CHARS;
    guaranteedChars.push(getRandomChar(NUMBER_CHARS));
  }
  if (options.includeSymbols) {
    charset += SYMBOL_CHARS;
    guaranteedChars.push(getRandomChar(SYMBOL_CHARS));
  }

  // Fallback if nothing is selected (should be prevented by UI, but safe to have)
  if (charset === "") {
    charset = LOWERCASE_CHARS + UPPERCASE_CHARS + NUMBER_CHARS;
  }

  const remainingLength = options.length - guaranteedChars.length;
  let password = "";

  for (let i = 0; i < remainingLength; i++) {
    password += getRandomChar(charset);
  }

  // Combine and shuffle
  const finalPasswordArray = [...guaranteedChars, ...password.split("")];
  
  // Fisher-Yates shuffle using crypto API
  for (let i = finalPasswordArray.length - 1; i > 0; i--) {
    const randomArray = new Uint32Array(1);
    window.crypto.getRandomValues(randomArray);
    const j = randomArray[0] % (i + 1);
    [finalPasswordArray[i], finalPasswordArray[j]] = [finalPasswordArray[j], finalPasswordArray[i]];
  }

  return finalPasswordArray.join("");
}

function getRandomChar(charset: string): string {
  if (charset.length === 0) return "";
  const randomArray = new Uint32Array(1);
  window.crypto.getRandomValues(randomArray);
  const randomIndex = randomArray[0] % charset.length;
  return charset[randomIndex];
}
