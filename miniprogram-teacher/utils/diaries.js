const api = require("./api");

const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

const MOODS = [
  { value: "HAPPY", label: "开心" },
  { value: "FOCUSED", label: "专注" },
  { value: "ENERGETIC", label: "活力" },
  { value: "CALM", label: "安静" },
  { value: "NEEDS_ATTENTION", label: "需关注" },
];

function moodLabel(value) {
  const item = MOODS.find((mood) => mood.value === value);
  return item ? item.label : "";
}

/** 选择图片（压缩模式），返回临时文件列表。 */
function chooseImages(count) {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count,
      mediaType: ["image"],
      sizeType: ["compressed"],
      success(res) {
        resolve(res.tempFiles || []);
      },
      fail(error) {
        reject(error);
      },
    });
  });
}

function readBase64(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      encoding: "base64",
      success(res) {
        resolve(res.data);
      },
      fail(error) {
        reject(error);
      },
    });
  });
}

/**
 * 逐张上传照片；失败时把已上传的照片挂在 error.uploaded 上，便于回滚。
 */
async function uploadPhotos(entryId, tempFiles) {
  const uploaded = [];
  try {
    for (const file of tempFiles) {
      const dataBase64 = await readBase64(file.tempFilePath);
      const data = await api.addDiaryPhoto(entryId, dataBase64);
      uploaded.push(data.photo);
    }
    return uploaded;
  } catch (error) {
    error.uploaded = uploaded;
    throw error;
  }
}

module.exports = {
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  MOODS,
  moodLabel,
  chooseImages,
  readBase64,
  uploadPhotos,
};
