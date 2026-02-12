import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Upload, 
  Loader2, 
  X, 
  ChevronUp, 
  ChevronDown,
  AlertCircle,
  Image as ImageIcon
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

export default function OfferGallery({ offerId, attachments = [], galleryMeta = {}, onGalleryUpdated }) {
  const [uploading, setUploading] = useState(false);
  const [editingCaptions, setEditingCaptions] = useState({});
  const fileInputRef = useRef(null);

  // Parse and sort attachments
  const galleryItems = attachments
    .map((url, idx) => ({
      url,
      id: url,
      caption: galleryMeta[url]?.caption || '',
      sort_index: galleryMeta[url]?.sort_index ?? idx,
    }))
    .sort((a, b) => a.sort_index - b.sort_index);

  const handleFileSelect = async (files) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
      
      if (fileArray.length === 0) {
        toast.error('Please select image files only');
        return;
      }

      const newUrls = [];
      for (const file of fileArray) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        newUrls.push(file_url);
      }

      const updatedAttachments = [...attachments, ...newUrls];
      const updatedMeta = { ...galleryMeta };
      
      newUrls.forEach((url, idx) => {
        updatedMeta[url] = {
          caption: '',
          sort_index: attachments.length + idx,
        };
      });

      await base44.entities.Offer.update(offerId, {
        attachments: updatedAttachments,
        gallery_meta: updatedMeta,
      });

      toast.success(`${newUrls.length} image(s) uploaded`);
      onGalleryUpdated?.();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleCaptionChange = (url, caption) => {
    setEditingCaptions(prev => ({
      ...prev,
      [url]: caption,
    }));
  };

  const saveCaptions = async () => {
    try {
      const updatedMeta = { ...galleryMeta };
      Object.keys(editingCaptions).forEach(url => {
        if (!updatedMeta[url]) updatedMeta[url] = {};
        updatedMeta[url].caption = editingCaptions[url];
      });

      await base44.entities.Offer.update(offerId, {
        gallery_meta: updatedMeta,
      });

      setEditingCaptions({});
      toast.success('Captions saved');
      onGalleryUpdated?.();
    } catch (error) {
      console.error('Error saving captions:', error);
      toast.error('Failed to save captions');
    }
  };

  const reorderImage = async (index, direction) => {
    const newItems = [...galleryItems];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex < 0 || newIndex >= newItems.length) return;

    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];

    const updatedMeta = { ...galleryMeta };
    newItems.forEach((item, idx) => {
      updatedMeta[item.url] = {
        ...updatedMeta[item.url],
        sort_index: idx,
      };
    });

    try {
      await base44.entities.Offer.update(offerId, {
        gallery_meta: updatedMeta,
      });
      onGalleryUpdated?.();
    } catch (error) {
      console.error('Error reordering:', error);
      toast.error('Failed to reorder images');
    }
  };

  const hasMinimumImages = galleryItems.length >= 6;

  const deleteImage = async (url) => {
    // Warn if deleting would drop below 6 images
    if (galleryItems.length === 6) {
      toast.warning('Gallery will no longer be included in PDF (need minimum 6 images)');
    }

    try {
      const updatedAttachments = attachments.filter(a => a !== url);
      const updatedMeta = { ...galleryMeta };
      delete updatedMeta[url];

      await base44.entities.Offer.update(offerId, {
        attachments: updatedAttachments,
        gallery_meta: updatedMeta,
      });

      toast.success('Image removed');
      onGalleryUpdated?.();
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('Failed to delete image');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Gallery (Optional)
        </CardTitle>
        <p className="text-xs text-slate-500 mt-2">Upload up to 8 images. Recommended: 6–8 images for best PDF appearance.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Section */}
        <div className="space-y-3">
          <Label>Upload Images</Label>
          <div className="flex gap-2">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || galleryItems.length >= 8}
              className="gap-2"
              variant="outline"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading...' : 'Choose Images'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
              disabled={uploading}
            />
            <span className="text-sm text-slate-500 flex items-center">
              {galleryItems.length}/8 max
            </span>
          </div>
          {galleryItems.length >= 8 && (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-sm">
                Maximum 8 images reached
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Gallery Grid */}
        {galleryItems.length > 0 && (
          <div className="space-y-4">
            <div className="grid gap-4">
              {galleryItems.map((item, idx) => (
                <div
                  key={item.url}
                  className="border rounded-lg p-4 space-y-3"
                >
                  {/* Thumbnail & Info */}
                  <div className="flex gap-4">
                    <img
                      src={item.url}
                      alt={`Gallery ${idx + 1}`}
                      className="h-24 w-24 rounded object-cover border"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="text-sm font-medium text-slate-600">
                        Image {idx + 1}
                      </div>
                      <input
                        type="text"
                        placeholder="Add a caption (optional)"
                        value={editingCaptions[item.url] ?? item.caption}
                        onChange={(e) =>
                          handleCaptionChange(item.url, e.target.value)
                        }
                        className="w-full px-2 py-1 text-sm border rounded"
                      />
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex gap-2">
                    {idx > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => reorderImage(idx, 'up')}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                    )}
                    {idx < galleryItems.length - 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => reorderImage(idx, 'down')}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteImage(item.url)}
                      className="text-red-600 hover:text-red-700 ml-auto"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Save Captions Button */}
            {Object.keys(editingCaptions).length > 0 && (
              <Button
                onClick={saveCaptions}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Save Captions
              </Button>
            )}
          </div>
        )}

        {galleryItems.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <ImageIcon className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">No images yet. Upload to get started.</p>
          </div>
        )}

        {/* Minimum Images Warning */}
        {galleryItems.length > 0 && galleryItems.length < 6 && (
          <Alert className="bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 text-sm">
              {6 - galleryItems.length} more image(s) needed. Gallery will not appear in PDF until minimum 6 images are uploaded.
            </AlertDescription>
          </Alert>
        )}

        {/* Ready for PDF */}
        {hasMinimumImages && (
          <Alert className="bg-green-50 border-green-200">
            <AlertCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 text-sm">
              ✓ Gallery with {galleryItems.length} image(s) will be included in PDF export.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}