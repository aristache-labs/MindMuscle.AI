import { Asset } from 'expo-asset';
import { ImageSourcePropType } from 'react-native';

export const STATIC_IMAGES = {
  measurements: {
    weight: require('../../assets/measurements/instructions/weight-instruction.png'),
    biceps: require('../../assets/measurements/instructions/biceps-instruction.png'),
    chest: require('../../assets/measurements/instructions/chest-instruction.png'),
    waist: require('../../assets/measurements/instructions/waist-instruction.png'),
    abs: require('../../assets/measurements/instructions/abs-instruction.png'),
    shoulders: require('../../assets/measurements/instructions/shoulders-instruction.png'),
    thigh: require('../../assets/measurements/instructions/thigh-instruction.png'),
    calf: require('../../assets/measurements/instructions/calf-instruction.png'),
  },
  bodyModel: {
    front: require('../../assets/body-model_front.png'),
    back: require('../../assets/body-model_back.png')
  }
};

export async function preloadStaticImages(): Promise<void> {
  console.log('🎯 Starting to preload static images...');
  
  try {
    const measurementImages = Object.values(STATIC_IMAGES.measurements);
    const bodyModelImages = Object.values(STATIC_IMAGES.bodyModel);
    const allImages = [...measurementImages, ...bodyModelImages];
    
    console.log(`📦 Found ${allImages.length} images to preload:`, {
      measurements: measurementImages.length,
      bodyModel: bodyModelImages.length
    });

    await Promise.all(allImages.map(async (image, index) => {
      await Asset.loadAsync(image);
      console.log(`✅ Loaded image ${index + 1}/${allImages.length}`);
    }));

    console.log('🎉 Successfully preloaded all static images');
  } catch (error) {
    console.error('❌ Failed to preload static images:', error);
    throw error; // Re-throw to handle it in the app initialization
  }
} 