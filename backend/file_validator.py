import os
from werkzeug.utils import secure_filename

def allowed_file(filename, allowed_extensions):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in allowed_extensions

def validate_csv(file):
    """
    Validates if the uploaded file is a valid CSV file.
    Returns a tuple (is_valid, message)
    """
    if file.filename == '':
        return False, "No selected file."
        
    if not allowed_file(file.filename, {'csv'}):
        return False, "Invalid file format. Only CSV files are allowed."
        
    return True, "File is valid."
