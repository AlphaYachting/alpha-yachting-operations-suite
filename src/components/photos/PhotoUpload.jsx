import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Camera, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { processPhoto } from './ImageCompressor';
import { toast } from 'sonner';

export default function PhotoUpload({ workOrderId, tasks, onSuccess }) {
  const [showDialog, setShowDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (files) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const queue = fileArray.map((file, idx) => ({
      id: `${Date.now()}_${idx}`,
      file,
      status: 'pending',
      progress: 0,
      category: 'Other',
      caption: '',
      taskId: ''
    }));

    setUploadQueue(queue);
    setShowDialog(true);
  };

  const updateQueueItem = (id, updates) => {
    setUploadQueue(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const removeQueueItem = (id) => {
    setUploadQueue(prev => prev.filter(item => item.id !== id));
  };

  const uploadSinglePhoto = async (queueItem) => {
    try {
      updateQueueItem(queueItem.id, { status: 'processing', progress: 20 });

      // Compress images
      const { main, thumb, originalName } = await processPhoto(queueItem.file);
      
      updateQueueItem(queueItem.id, { progress: 50 });

      // Upload main image
      const mainFile = new File([main.blob], originalName, { type: 'image/jpeg' });
      const { file_url: mainUrl } = await base44.integrations.Core.UploadFile({ file: mainFile });
      
      updateQueueItem(queueItem.id, { progress: 70 });

      // Upload thumbnail
      const thumbFile = new File([thumb.blob], `thumb_${originalName}`, { type: 'image/jpeg' });
      const { file_url: thumbUrl } = await base44.integrations.Core.UploadFile({ file: thumbFile });
      
      updateQueueItem(queueItem.id, { progress: 90 });

      // Save metadata
      await base44.entities.WorkOrderPhoto.create({
        work_order_id: workOrderId,
        task_id: queueItem.taskId || null,
        category: queueItem.category,
        caption: queueItem.caption || null,
        file_url: mainUrl,
        thumb_url: thumbUrl,
        file_size_bytes: main.blob.size,
        width: main.width,
        height: main.height,
        is_customer_visible: queueItem.category === 'Expenses' ? false : false
      });

      updateQueueItem(queueItem.id, { status: 'success', progress: 100 });
      return true;
    } catch (error) {
      console.error('Upload error:', error);
      updateQueueItem(queueItem.id, { 
        status: 'error', 
        error: error.message || 'Upload failed' 
      });
      return false;
    }
  };

  const handleUploadAll = async () => {
    setUploading(true);
    
    const results = await Promise.allSettled(
      uploadQueue.filter(item => item.status === 'pending').map(uploadSinglePhoto)
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failCount = results.length - successCount;

    if (successCount > 0) {
      toast.success(`${successCount} photo${successCount > 1 ? 's' : ''} uploaded successfully`);
      onSuccess?.();
    }
    if (failCount > 0) {
      toast.error(`${failCount} photo${failCount > 1 ? 's' : ''} failed to upload`);
    }

    setUploading(false);
    
    // Close if all succeeded
    if (failCount === 0) {
      setTimeout(() => {
        setShowDialog(false);
        setUploadQueue([]);
      }, 1000);
    }
  };

  return (
    <>
      <div className="flex gap-3">
        <Button
          onClick={() => fileInputRef.current?.click()}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Photos
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
      </div>

      <Dialog open={showDialog} onOpenChange={(open) => {
        if (!uploading) {
          setShowDialog(open);
          if (!open) setUploadQueue([]);
        }
      }}>
        <DialogContent className="w-full max-w-3xl max-h-[90vh] overflow-y-auto mx-auto px-4 sm:px-0">
          <DialogHeader>
            <DialogTitle>Upload Photos ({uploadQueue.length})</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {uploadQueue.map((item) => (
              <div key={item.id} className="border rounded-lg p-3 sm:p-4 space-y-3">
                <div className="flex items-start justify-between gap-2 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-900 truncate">
                      {item.file.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {(item.file.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  {item.status === 'pending' && !uploading && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeQueueItem(item.id)}
                      className="h-8 w-8 flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  {item.status === 'success' && (
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                  )}
                  {item.status === 'error' && (
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                  )}
                  {item.status === 'processing' && (
                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin flex-shrink-0" />
                  )}
                </div>

                {item.status === 'pending' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Category</Label>
                      <Select
                        value={item.category}
                        onValueChange={(v) => updateQueueItem(item.id, { category: v })}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Before">Before</SelectItem>
                          <SelectItem value="During">During</SelectItem>
                          <SelectItem value="After">After</SelectItem>
                          <SelectItem value="Damage">Damage</SelectItem>
                          <SelectItem value="Expenses">Expenses</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {tasks.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs">Task (Optional)</Label>
                        <Select
                          value={item.taskId}
                          onValueChange={(v) => updateQueueItem(item.id, { taskId: v })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="General" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={null}>General</SelectItem>
                            {tasks.map(task => (
                              <SelectItem key={task.id} value={task.id}>
                                {task.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                {item.status === 'pending' && (
                  <div className="space-y-2">
                    <Label className="text-xs">Caption (Optional)</Label>
                    <Textarea
                      value={item.caption}
                      onChange={(e) => updateQueueItem(item.id, { caption: e.target.value })}
                      placeholder="Add a description..."
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                )}

                {item.status === 'processing' && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Processing...</span>
                      <span>{item.progress}%</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {item.status === 'error' && (
                  <p className="text-sm text-red-600">{item.error}</p>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setShowDialog(false);
                setUploadQueue([]);
              }}
              disabled={uploading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUploadAll}
              disabled={uploading || uploadQueue.filter(i => i.status === 'pending').length === 0}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>Upload {uploadQueue.filter(i => i.status === 'pending').length} Photo{uploadQueue.filter(i => i.status === 'pending').length !== 1 ? 's' : ''}</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}