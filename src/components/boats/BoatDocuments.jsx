import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  X, 
  Download, 
  FileText, 
  Image as ImageIcon,
  AlertCircle,
  Loader2,
  FileJson
} from 'lucide-react';
import { format } from 'date-fns';

const ALLOWED_TYPES = {
  'application/pdf': { label: 'PDF', icon: FileText },
  'image/jpeg': { label: 'JPEG', icon: ImageIcon },
  'image/png': { label: 'PNG', icon: ImageIcon }
};

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB for PDFs
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB for images
const TARGET_IMAGE_SIZE = 1024 * 1024; // Target 1 MB after compression
const JPEG_QUALITY = 0.75;

const getDocTypeColor = (type) => {
  const colors = {
    'Registration/Seebrief': 'bg-blue-100 text-blue-800',
    'Insurance': 'bg-green-100 text-green-800',
    'Certificate': 'bg-purple-100 text-purple-800',
    'Invoice': 'bg-amber-100 text-amber-800',
    'Other': 'bg-slate-100 text-slate-800'
  };
  return colors[type] || colors['Other'];
};

const compressImage = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const ratio = width / height;
        
        // Scale down if needed while maintaining aspect ratio
        if (width > 2000) {
          width = 2000;
          height = width / ratio;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob.size > TARGET_IMAGE_SIZE) {
              // If still too large, retry with lower quality
              canvas.toBlob(
                (retryBlob) => resolve(retryBlob),
                'image/jpeg',
                0.6
              );
            } else {
              resolve(blob);
            }
          },
          'image/jpeg',
          JPEG_QUALITY
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
  });
};

export default function BoatDocuments({ boatId, userRole }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewTitle, setPreviewTitle] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const canUpload = userRole === 'admin' || userRole === 'organizer';

  useEffect(() => {
    loadDocuments();
  }, [boatId]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const docs = await base44.entities.BoatDocument.filter({ boat_id: boatId });
      setDocuments(docs);
    } catch (err) {
      console.error('Error loading documents:', err);
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError(null);

    // Validate MIME type
    if (!ALLOWED_TYPES[file.type]) {
      setError('File type not supported. Use PDF, JPG, or PNG.');
      return;
    }

    // Validate file size
    const isImage = file.type.startsWith('image/');
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
    if (file.size > maxSize) {
      const maxMB = maxSize / (1024 * 1024);
      setError(`File too large. Max ${maxMB}MB for ${isImage ? 'images' : 'PDFs'}.`);
      return;
    }

    setUploading(true);
    try {
      let uploadFile = file;
      let fileName = file.name;

      // Compress images if needed
      if (isImage && file.size > TARGET_IMAGE_SIZE) {
        uploadFile = await compressImage(file);
        fileName = file.name.replace(/\.[^.]+$/, '.jpg');
      }

      // Upload file
      const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadFile });

      // Create document record
      const docRecord = await base44.entities.BoatDocument.create({
        boat_id: boatId,
        document_type: 'Other',
        title: file.name,
        file_url,
        file_name_original: file.name,
        mime_type: uploadFile.type || file.type,
        file_size_bytes: uploadFile.size || file.size,
        thumb_url: isImage ? file_url : null
      });

      setDocuments([...documents, docRecord]);
      // Reset file input
      e.target.value = '';
    } catch (err) {
      console.error('Error uploading document:', err);
      setError('Failed to upload document. Try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!confirm('Delete this document?')) return;

    try {
      await base44.entities.BoatDocument.delete(docId);
      setDocuments(documents.filter(d => d.id !== docId));
    } catch (err) {
      console.error('Error deleting document:', err);
      setError('Failed to delete document');
    }
  };

  const handlePreview = (doc) => {
    if (doc.mime_type === 'application/pdf') {
      window.open(doc.file_url, '_blank');
    } else {
      setPreviewUrl(doc.file_url);
      setPreviewTitle(doc.title);
      setShowPreview(true);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Section */}
          {canUpload && (
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileUpload}
                className="hidden"
                id="boat-doc-upload"
                disabled={uploading}
              />
              <label htmlFor="boat-doc-upload" className="cursor-pointer block">
                {uploading ? (
                  <>
                    <Loader2 className="h-8 w-8 mx-auto text-slate-400 mb-2 animate-spin" />
                    <p className="text-sm text-slate-600">Uploading...</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                    <p className="text-sm text-slate-600">Click to upload document</p>
                    <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG • Max 20MB for PDF, 5MB for images</p>
                  </>
                )}
              </label>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Documents List */}
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8">
              <FileJson className="h-12 w-12 mx-auto text-slate-300 mb-2" />
              <p className="text-slate-500">No documents uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      {doc.mime_type === 'application/pdf' ? (
                        <FileText className="h-5 w-5 text-red-500 flex-shrink-0" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-blue-500 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900 truncate">{doc.title || doc.file_name_original || 'Untitled'}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                          <Badge className={getDocTypeColor(doc.document_type)}>
                            {doc.document_type}
                          </Badge>
                          <span>{formatFileSize(doc.file_size_bytes)}</span>
                          {doc.created_date && <span>{format(new Date(doc.created_date), 'MMM d, yyyy')}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreview(doc)}
                      title="Preview document"
                    >
                      {doc.mime_type === 'application/pdf' ? (
                        <FileText className="h-4 w-4" />
                      ) : (
                        <ImageIcon className="h-4 w-4" />
                      )}
                    </Button>
                    <a href={doc.file_url} download={doc.file_name_original} title="Download">
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                    {userRole === 'admin' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Delete document"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewTitle}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="relative w-full">
              <img src={previewUrl} alt="Preview" className="w-full h-auto max-h-[600px] object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}