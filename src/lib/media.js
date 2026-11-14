import { resolvedCloudinary } from '../firebase.js'

// Cloudinary unsigned upload — used because Firebase Spark projects no
// longer include a free Cloud Storage bucket.
export async function uploadMedia(file, { onProgress } = {}) {
  const { cloudName, uploadPreset } = resolvedCloudinary
  if (!cloudName || !uploadPreset) {
    throw new Error(
      'Photo uploads need your Cloudinary cloud name and an unsigned upload preset.'
    )
  }
  const form = new FormData()
  form.append('file', file)
  form.append('upload_preset', uploadPreset)

  onProgress?.(0.15)
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: 'POST',
    body: form,
  })
  onProgress?.(0.9)
  if (!res.ok) throw new Error('Upload failed — check the Cloudinary preset.')
  const data = await res.json()
  onProgress?.(1)
  return data.secure_url
}

export function pickImage({ accept = 'image/*' } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => resolve(input.files?.[0] || null)
    input.click()
  })
}
