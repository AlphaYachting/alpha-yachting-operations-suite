import React, { useState } from 'react';
import { format } from 'date-fns';
import { Camera, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export default function CustomerJobTimeline({ photos, comments }) {
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const visiblePhotos = photos.filter(p => p.visible_to_customer !== false);
  const visibleComments = comments.filter(c => !c.is_internal);

  const timeline = [
    ...visiblePhotos.map(p => ({ type: 'photo', data: p, date: p.created_date })),
    ...visibleComments.map(c => ({ type: 'comment', data: c, date: c.created_date }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (timeline.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        No updates yet
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {timeline.map((item, idx) => (
          <div key={idx} className="flex gap-4">
            <div className="flex-shrink-0">
              {item.type === 'photo' ? (
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Camera className="h-5 w-5 text-blue-600" />
                </div>
              ) : (
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-green-600" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-500 mb-2">
                {format(new Date(item.date), 'MMM d, yyyy • h:mm a')}
              </p>
              {item.type === 'photo' ? (
                <button 
                  onClick={() => setSelectedPhoto(item.data.photo_url)}
                  className="block"
                >
                  <img 
                    src={item.data.photo_url} 
                    alt="Project update"
                    className="rounded-lg max-w-xs hover:opacity-90 transition-opacity"
                  />
                  {item.data.description && (
                    <p className="text-sm text-slate-700 mt-2">{item.data.description}</p>
                  )}
                </button>
              ) : (
                <div className="bg-slate-50 rounded-lg p-4">
                  {item.data.author_name && (
                    <p className="text-sm font-medium text-slate-900 mb-1">
                      {item.data.author_name}
                    </p>
                  )}
                  <p className="text-slate-700">{item.data.content}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl">
          {selectedPhoto && (
            <img src={selectedPhoto} alt="Full size" className="w-full h-auto" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}