const pickImage = async (type: 'before' | 'after') => {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      if (type === 'before') {
        setBeforeImage(uri);
      } else {
        setAfterImage(uri);
      }
    }
  } catch (error) {
    console.error('Error picking image:', error);
  }
}; 