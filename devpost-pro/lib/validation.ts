export function validateGithubUrl(url: string): string | null {
  const pattern = /^https:\/\/github\.com\/[\w-]+\/[\w.-]+\/?$/;
  if (!url) return "GitHub URL is required";
  if (!pattern.test(url))
    return "Please enter a valid GitHub repository URL (e.g. https://github.com/username/repo)";
  return null;
}

export function validateLinkedinUrl(url: string): string | null {
  const pattern = /^https:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/;
  if (!url) return "LinkedIn URL is required";
  if (!pattern.test(url))
    return "Please enter a valid LinkedIn profile URL (e.g. https://linkedin.com/in/username)";
  return null;
}
