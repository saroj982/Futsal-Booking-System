// Cloudinary configuration for frontend uploads
// Using unsigned uploads - create an upload preset in Cloudinary Dashboard
export const CLOUDINARY_CONFIG = {
  cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dkvts2nc3",
  // You need to create an unsigned upload preset in Cloudinary Dashboard:
  // Settings > Upload > Upload presets > Add upload preset
  // Set Signing Mode to "Unsigned" and note the preset name
  uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "futsal_unsigned",
};

// Upload image to Cloudinary (unsigned upload)
export const uploadToCloudinary = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);
  formData.append("folder", "futsal_grounds");

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Upload failed");
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
};

// Upload multiple images to Cloudinary
export const uploadMultipleToCloudinary = async (files, onProgress) => {
  const urls = [];
  const totalFiles = files.length;

  for (let i = 0; i < files.length; i++) {
    const url = await uploadToCloudinary(files[i]);
    urls.push(url);
    if (onProgress) {
      onProgress(((i + 1) / totalFiles) * 100);
    }
  }

  return urls;
};
