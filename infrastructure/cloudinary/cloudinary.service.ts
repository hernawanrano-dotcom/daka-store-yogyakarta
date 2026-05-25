import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiOptions, UploadApiResponse } from 'cloudinary';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadImage(
    base64Image: string,
    options?: UploadApiOptions,
  ): Promise<UploadApiResponse> {
    try {
      // Remove base64 prefix if present
      let imageData = base64Image;
      if (base64Image.includes('base64,')) {
        imageData = base64Image.split('base64,')[1];
      }

      const uploadOptions: UploadApiOptions = {
        folder: 'daka-store',
        ...options,
      };

      const result = await cloudinary.uploader.upload(`data:image/jpeg;base64,${imageData}`, uploadOptions);
      
      this.logger.debug(`Image uploaded: ${result.secure_url}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to upload image: ${error.message}`);
      throw new BadRequestException('Failed to upload image to Cloudinary');
    }
  }

  async uploadMultipleImages(
    images: string[],
    options?: UploadApiOptions,
  ): Promise<UploadApiResponse[]> {
    const uploads = images.map((image) => this.uploadImage(image, options));
    return Promise.all(uploads);
  }

  async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
      this.logger.debug(`Image deleted: ${publicId}`);
    } catch (error) {
      this.logger.error(`Failed to delete image: ${error.message}`);
      throw new BadRequestException('Failed to delete image from Cloudinary');
    }
  }

  extractPublicId(imageUrl: string): string | null {
    // Extract public_id from Cloudinary URL
    // Format: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/image_id.jpg
    const matches = imageUrl.match(/\/upload\/v\d+\/(.+)\.\w+$/);
    if (matches && matches[1]) {
      return matches[1];
    }
    return null;
  }

  async getOptimizedUrl(publicId: string, width?: number, height?: number): Promise<string> {
    const transformations: string[] = [];
    
    if (width && height) {
      transformations.push(`c_fill,w_${width},h_${height}`);
    } else if (width) {
      transformations.push(`w_${width}`);
    } else if (height) {
      transformations.push(`h_${height}`);
    }
    
    transformations.push('q_auto', 'f_auto');
    
    return cloudinary.url(publicId, {
      transformation: transformations,
    });
  }
}