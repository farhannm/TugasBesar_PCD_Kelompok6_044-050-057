import cv2
import mediapipe as mp
import numpy as np
import logging

logger = logging.getLogger(__name__)
class FaceDetector:
    def __init__(self):
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            max_num_faces=1, 
            refine_landmarks=True,
            min_detection_confidence=0.5, 
            min_tracking_confidence=0.5
        )
        self.mp_drawing = mp.solutions.drawing_utils
        
        # For smoothing nose position
        self.nose_positions = []
        self.smoothing_window = 3
        
        # Calibration variables
        self.nose_y_min = None
        self.nose_y_max = None
        self.calibration_frames = 0
        self.max_calibration_frames = 30
        self.is_calibrated = False
        
        # Default bird position
        self.default_bird_pos = 5.0
        
        # Face detection tracking
        self.no_face_count = 0
        self.max_no_face_frames = 10

    def detect_nose_position(self, frame):
        if frame is None:
            return self.default_bird_pos, frame
            
        # Resize frame for better performance
        height, width = frame.shape[:2]
        if width > 800:
            scale = 800.0 / width
            new_width = int(width * scale)
            new_height = int(height * scale)
            frame = cv2.resize(frame, (new_width, new_height))
            height, width = new_height, new_width
        
        # Convert BGR to RGB
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        image.flags.writeable = False
        results = self.face_mesh.process(image)
        
        # Convert back to BGR for OpenCV
        image.flags.writeable = True
        image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

        bird_pos_y = self.default_bird_pos
        
        if results.multi_face_landmarks:
            self.no_face_count = 0
            
            for face_landmarks in results.multi_face_landmarks:
                # Get nose tip landmark (index 1)
                nose_tip = face_landmarks.landmark[1]
                
                # Convert to pixel coordinates
                nose_x_pixel = int(nose_tip.x * width)
                nose_y_pixel = int(nose_tip.y * height)
                
                # Draw yellow circle at nose
                cv2.circle(image, (nose_x_pixel, nose_y_pixel), 8, (0, 255, 255), -1)
                cv2.circle(image, (nose_x_pixel, nose_y_pixel), 12, (0, 0, 255), 2)
                
                # Calibration phase
                if not self.is_calibrated:
                    self.calibrate_nose_position(nose_tip.y)
                    if self.calibration_frames >= self.max_calibration_frames:
                        self.is_calibrated = True
                        logger.info(f"Calibration complete! Range: {self.nose_y_min:.3f} - {self.nose_y_max:.3f}")
                
                # Map nose position to bird position after calibration
                if self.is_calibrated:
                    bird_pos_y = self.map_nose_to_bird_position(nose_tip.y)
                    
                    # Apply smoothing
                    self.nose_positions.append(bird_pos_y)
                    if len(self.nose_positions) > self.smoothing_window:
                        self.nose_positions.pop(0)
                    
                    if len(self.nose_positions) > 0:
                        bird_pos_y = sum(self.nose_positions) / len(self.nose_positions)
                
                # Draw vertical guide line with matching yellow dot on the right side
                guide_x = width - 50
                guide_y_start = 50
                guide_y_end = height - 50
                cv2.line(image, (guide_x, guide_y_start), (guide_x, guide_y_end), (128, 128, 128), 2)
                # Map bird_pos_y (0.5 to 8.5) to guide line range
                guide_y = int(guide_y_start + (guide_y_end - guide_y_start) * (8.5 - bird_pos_y) / 8.0)
                cv2.circle(image, (guide_x, guide_y), 8, (0, 255, 255), -1)
                cv2.circle(image, (guide_x, guide_y), 12, (0, 0, 255), 2)
                
                break
        else:
            self.no_face_count += 1
            if self.no_face_count > self.max_no_face_frames:
                bird_pos_y = self.default_bird_pos

        return bird_pos_y, image

    def calibrate_nose_position(self, nose_y):
        """Calibrate the range of nose movement"""
        if self.nose_y_min is None or nose_y < self.nose_y_min:
            self.nose_y_min = nose_y
        if self.nose_y_max is None or nose_y > self.nose_y_max:
            self.nose_y_max = nose_y
        
        self.calibration_frames += 1

    def map_nose_to_bird_position(self, nose_y):
        """Map nose Y position to bird position (0-9)"""
        if self.nose_y_min is None or self.nose_y_max is None:
            return self.default_bird_pos
        
        y_range = self.nose_y_max - self.nose_y_min
        if y_range < 0.02:
            return self.default_bird_pos
        
        # Normalize nose position within the calibrated range (no inversion)
        normalized_y = (nose_y - self.nose_y_min) / y_range
        
        # Clamp to 0-1 range with some tolerance
        normalized_y = max(-0.1, min(1.1, normalized_y))
        
        # Map to bird positions (0.5 to 8.5) directly (no inversion)
        bird_pos_y = normalized_y * 8.0 + 0.5
        
        return max(0.5, min(8.5, bird_pos_y))

    def draw_debug_info(self, image, nose_tip_y, bird_pos_y, width, height):
        # This function is now empty as we removed all debug text
        pass

    def draw_game_guide(self, image, bird_pos_y, width, height):
        # This function is replaced by the guide line in detect_nose_position
        pass

    def reset_calibration(self):
        """Reset calibration for a new user"""
        self.nose_y_min = None
        self.nose_y_max = None
        self.calibration_frames = 0
        self.is_calibrated = False
        self.nose_positions = []
        self.no_face_count = 0
        logger.info("Calibration reset")

    def release(self):
        """Release MediaPipe resources"""
        if hasattr(self, 'face_mesh'):
            self.face_mesh.close()