/**
 * Deliberately conservative: an image noun alone is not enough. The request
 * must connect an action to a deictic/ownership word such as "this photo",
 * "my image", or "the uploaded pictures".
 */
export function explicitlyRequestsUploadedImages(prompt: string): boolean {
  const text = prompt.toLowerCase().replace(/\s+/g, ' ');
  const action = '(?:use|include|feature|place|add|show|incorporate|with)';
  const selected = '(?:this|these|my|our|the uploaded|uploaded|attached|selected|provided)';
  const image = '(?:photo|photos|photograph|photographs|image|images|picture|pictures)';
  return (
    new RegExp(`${action}[^.!?\\n]{0,50}${selected}\\s+${image}`, 'i').test(text) ||
    new RegExp(`${selected}\\s+${image}[^.!?\\n]{0,50}${action}`, 'i').test(text)
  );
}
