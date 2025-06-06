import cv2
import mediapipe as mp
import numpy as np

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
        self.mp_drawing_styles = mp.solutions.drawing_styles
        
        # For smoothing nose position
        self.nose_positions = []
        self.smoothing_window = 5

    def detect_nose_position(self, frame):
        if frame is None:
            return 5, frame
            
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        image.flags.writeable = False
        results = self.face_mesh.process(image)
        
        image.flags.writeable = True
        image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

        bird_pos_y = 5  # Default posisi tengah
        
        if results.multi_face_landmarks:
            for face_landmarks in results.multi_face_landmarks:
                # Draw face mesh
                self.mp_drawing.draw_landmarks(
                    image=image,
                    landmark_list=face_landmarks,
                    connections=self.mp_face_mesh.FACEMESH_CONTOURS,
                    landmark_drawing_spec=None,
                    connection_drawing_spec=self.mp_drawing_styles
                    .get_default_face_mesh_contours_style()
                )
                
                # Get nose tip landmark (index 1 is nose tip)
                nose_tip = face_landmarks.landmark[1]
                image_height, image_width, _ = image.shape
                
                # Convert normalized coordinates to pixel coordinates
                nose_y = int(nose_tip.y * image_height)
                nose_x = int(nose_tip.x * image_width)
                
                # Draw nose point
                cv2.circle(image, (nose_x, nose_y), 5, (0, 255, 0), -1)
                
                # Map nose position to bird position (0-9)
                # Invert Y axis since webcam Y increases downward but game Y increases upward
                normalized_y = 1.0 - nose_tip.y
                bird_pos_y = int(normalized_y * 9)
                bird_pos_y = max(0, min(9, bird_pos_y))
                
                # Smooth the position
                self.nose_positions.append(bird_pos_y)
                if len(self.nose_positions) > self.smoothing_window:
                    self.nose_positions.pop(0)
                
                bird_pos_y = int(sum(self.nose_positions) / len(self.nose_positions))
                
                # Draw position indicator
                cv2.putText(image, f"Bird Y: {bird_pos_y}", (10, 30), 
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

        return bird_pos_y, image

    def release(self):
        # MediaPipe doesn't need explicit release for face mesh
        pass