import { useCallback, useEffect, useRef, useState } from 'react';
import {
  resolveDepartmentForSubmit,
  validateWizardStep,
} from '../utils/bookUploadMeta';

const initialUploadForm = () => ({
  title: '',
  description: '',
  file: null,
  academicTrack: '',
  department: '',
  departmentOther: '',
  publishYear: new Date().getFullYear(),
  courseSubject: '',
});

/** Shared upload wizard state + handlers for UploadBookModal (Library page, Profile, etc.). */
export function useBookUploadModal({
  /** Called after successful upload (e.g. refetch library list). */
  onSuccess,
} = {}) {
  const fileInputRef = useRef(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadStep, setUploadStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [uploadForm, setUploadForm] = useState(initialUploadForm);

  useEffect(() => {
    if (!isUploadModalOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isUploadModalOpen]);

  const closeUploadModal = useCallback(() => {
    setIsUploadModalOpen(false);
    setUploadStep(1);
    setUploadError('');
    setDragActive(false);
    setUploadForm(initialUploadForm());
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const openUploadModal = useCallback(() => {
    setUploadError('');
    setUploadStep(1);
    setIsUploadModalOpen(true);
  }, []);

  const goUploadNext = useCallback(() => {
    const err = validateWizardStep(uploadStep, uploadForm);
    if (err) {
      setUploadError(err);
      return;
    }
    setUploadError('');
    setUploadStep((s) => Math.min(3, s + 1));
  }, [uploadStep, uploadForm]);

  const goUploadPrev = useCallback(() => {
    setUploadError('');
    setUploadStep((s) => Math.max(1, s - 1));
  }, []);

  const handleUploadSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      setUploadError('');

      const stepErr = validateWizardStep(3, uploadForm);
      if (stepErr) {
        setUploadError(stepErr);
        return;
      }

      const dept = resolveDepartmentForSubmit(uploadForm);
      if (!dept || dept === 'Other') {
        setUploadError('Complete department details.');
        setUploadStep(1);
        return;
      }

      try {
        setUploading(true);

        const formData = new FormData();
        formData.append('academicTrack', uploadForm.academicTrack);
        formData.append('department', dept);
        formData.append('title', uploadForm.title.trim());
        formData.append('publishYear', String(Number(uploadForm.publishYear)));
        formData.append('courseSubject', uploadForm.courseSubject.trim());
        if (uploadForm.description.trim()) {
          formData.append('description', uploadForm.description.trim());
        }
        formData.append('file', uploadForm.file);

        const res = await fetch('/api/upload/file', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload?.message || 'Failed to upload book');
        }

        closeUploadModal();
        if (typeof onSuccess === 'function') {
          void onSuccess(payload);
        }
      } catch (err) {
        setUploadError(err?.message || 'Could not upload this book');
      } finally {
        setUploading(false);
      }
    },
    [uploadForm, closeUploadModal, onSuccess],
  );

  const onDropZoneDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    if (e.type === 'dragleave') setDragActive(false);
  }, []);

  const onDropFile = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      setUploadForm((prev) => ({ ...prev, file }));
      setUploadError('');
    }
  }, []);

  return {
    fileInputRef,
    openUploadModal,
    uploadModalProps: {
      open: isUploadModalOpen,
      uploadStep,
      uploadForm,
      setUploadForm,
      uploading,
      uploadError,
      setUploadError,
      dragActive,
      fileInputRef,
      onClose: closeUploadModal,
      onNext: goUploadNext,
      onPrev: goUploadPrev,
      onSubmit: handleUploadSubmit,
      onDropZoneDrag,
      onDropFile,
    },
  };
}
