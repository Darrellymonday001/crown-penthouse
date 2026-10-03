<?php
require_once __DIR__ . '/helpers.php';
$reference = trim($_POST['reference'] ?? '');
$document_type = trim($_POST['documentType'] ?? '');
if (!$reference || !$document_type) {
    send_json(['status' => false, 'message' => 'Reference and document type are required.'], 400);
}

if (empty($_FILES['document']) || $_FILES['document']['error'] !== UPLOAD_ERR_OK) {
    send_json(['status' => false, 'message' => 'No file uploaded or upload failed.'], 400);
}

$file = $_FILES['document'];
$allowed = ['application/pdf', 'image/jpeg', 'image/png'];
if (!in_array($file['type'], $allowed, true)) {
    send_json(['status' => false, 'message' => 'Invalid file type. Only PDF, JPG, and PNG are allowed.'], 400);
}

if ($file['size'] > 5 * 1024 * 1024) {
    send_json(['status' => false, 'message' => 'File exceeds maximum size of 5MB.'], 400);
}

$uploads = ensure_upload_dir();
$baseName = bin2hex(random_bytes(12)) . '-' . basename($file['name']);
$safeName = preg_replace('/[^a-zA-Z0-9._-]/', '-', $baseName);
$targetPath = $uploads . '/' . $safeName;

if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
    send_json(['status' => false, 'message' => 'Failed to save uploaded file.'], 500);
}

$recordSaved = save_upload_record([
    'reference_id' => $reference,
    'document_type' => $document_type,
    'filename' => $safeName,
    'original_filename' => $file['name'],
    'mime_type' => $file['type'],
    'size_bytes' => $file['size'],
]);

send_json([
    'status' => true,
    'message' => 'Document uploaded successfully.',
    'file' => [
        'name' => $safeName,
        'original_name' => $file['name'],
        'size' => $file['size'],
        'mime_type' => $file['type'],
    ],
    'db_saved' => $recordSaved,
]);
