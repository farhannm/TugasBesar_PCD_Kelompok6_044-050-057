import random
import os
import time

class Game:
    def __init__(self):
        # Game modes
        self.game_mode = "preview"  # "preview", "playing", "paused", "game_over"
        
        # Score system
        self.score = 0
        self.highscore = self.read_highscore()
        
        # Bird physics
        self.bird_pos_y = 5.0  # Float untuk posisi yang lebih smooth
        self.bird_velocity = 0.0
        self.gravity = 0.4  # Reduced gravity for slower start
        self.terminal_velocity = 6.0  # Reduced terminal velocity
        
        # Pipes system
        self.pipes = []
        self.pipe_speed = 0.2  # Start slow
        self.max_pipe_speed = 0.8  # Maximum speed
        self.speed_increase_rate = 0.02  # How fast speed increases
        self.pipe_count = 0  # Total pipes passed
        
        # Timing
        self.last_pipe_time = time.time()
        self.last_update_time = time.time()
        self.game_start_time = None
        
        # Game over dialog
        self.show_restart_dialog = False
        self.restart_dialog_start_time = None
        self.auto_restart_delay = 3.0  # Auto restart after 3 seconds
        
        # Preview mode - no obstacles, just bird movement
        self.preview_mode_active = True

    def read_highscore(self):
        try:
            with open("data/highscore.txt", "r") as f:
                return int(f.read())
        except:
            return 0

    def save_highscore(self):
        if self.score > self.highscore:
            os.makedirs("data", exist_ok=True)
            with open("data/highscore.txt", "w") as f:
                f.write(str(self.score))
            self.highscore = self.score
            
    def start_game(self):
        """Start the actual game with obstacles"""
        self.game_mode = "playing"
        self.preview_mode_active = False
        self.game_start_time = time.time()
        self.pipes = [{"x": 15, "gap_y": random.randint(3, 7)}]
        self.pipe_speed = 0.3  # Start slow
        self.score = 0
        self.pipe_count = 0
        self.bird_pos_y = 5.0
        self.bird_velocity = 0.0
        self.show_restart_dialog = False
        
    def pause_game(self):
        """Pause/unpause the game"""
        if self.game_mode == "playing":
            self.game_mode = "paused"
        elif self.game_mode == "paused":
            self.game_mode = "playing"
            self.last_update_time = time.time()  # Reset timer to prevent big jumps

    def enter_preview_mode(self):
        """Enter preview mode - bird movement only, no obstacles"""
        self.game_mode = "preview"
        self.preview_mode_active = True
        self.pipes = []
        self.score = 0
        self.pipe_count = 0
        self.bird_pos_y = 5.0
        self.bird_velocity = 0.0
        self.show_restart_dialog = False

    def handle_collision(self):
        """Handle collision with obstacles"""
        self.game_mode = "game_over"
        self.show_restart_dialog = True
        self.restart_dialog_start_time = time.time()
        self.save_highscore()

    def check_auto_restart(self):
        """Check if we should auto-restart after collision"""
        if (self.show_restart_dialog and 
            self.restart_dialog_start_time and
            time.time() - self.restart_dialog_start_time >= self.auto_restart_delay):
            self.restart()
            return True
        return False

    def update_game_speed(self):
        """Gradually increase game speed based on time played"""
        if self.game_start_time and self.game_mode == "playing":
            time_played = time.time() - self.game_start_time
            # Increase speed every 10 seconds
            speed_multiplier = 1 + (time_played / 10.0) * self.speed_increase_rate
            self.pipe_speed = min(self.max_pipe_speed, 0.2 * speed_multiplier)
            
    def update(self, detected_nose_y):
        current_time = time.time()
        dt = current_time - self.last_update_time
        
        if dt < 0.016:  # Limit update rate to ~60fps
            return
            
        # Check for auto-restart in game over mode
        if self.game_mode == "game_over":
            self.check_auto_restart()
            return
        
        # Update bird position based on nose detection
        if detected_nose_y is not None:
            # Smooth transition to detected position
            target_y = float(detected_nose_y)
            # Use interpolation for smoother movement
            self.bird_pos_y += (target_y - self.bird_pos_y) * 0.6
        else:
            # Apply gravity if no face detected
            if self.game_mode in ["playing", "preview"]:
                self.bird_velocity += self.gravity
                self.bird_velocity = min(self.bird_velocity, self.terminal_velocity)
                self.bird_pos_y += self.bird_velocity
        
        # Keep bird within bounds
        self.bird_pos_y = max(0.5, min(8.5, self.bird_pos_y))
        
        # Only update pipes and collision in playing mode
        if self.game_mode == "playing":
            self.update_game_speed()
            self.update_pipes()
            self.check_collisions()
            self.check_scoring()
        
        self.last_update_time = current_time

    def update_pipes(self):
        """Update pipe positions and spawn new ones"""
        # Move existing pipes
        for pipe in self.pipes:
            pipe["x"] -= self.pipe_speed
        
        # Remove pipes that are off screen
        self.pipes = [p for p in self.pipes if p["x"] >= -3]
        
        # Add new pipe when needed
        if not any(p["x"] > 15 for p in self.pipes):
            # Vary gap position and size for difficulty
            gap_y = random.randint(3, 7)
            self.pipes.append({"x": 22, "gap_y": gap_y})

    def check_scoring(self):
        """Check if bird passed through pipe for scoring"""
        scored_this_frame = False  # Flag untuk mencegah penghitungan ganda dalam satu frame
        for pipe in self.pipes:
            # Periksa hanya saat pipa baru saja melewati posisi burung (x sekitar 2.0)
            if not scored_this_frame and not hasattr(pipe, 'scored') and 1.8 <= pipe["x"] < 2.0:
                gap_start = pipe["gap_y"] - 1.5
                gap_end = pipe["gap_y"] + 1.5
                if gap_start <= self.bird_pos_y <= gap_end:
                    self.score += 10
                    self.pipe_count += 1
                    pipe['scored'] = True
                    scored_this_frame = True  # Tandai bahwa sudah mencetak skor di frame ini

    def check_collisions(self):
        """Check for collisions with pipes or boundaries"""
        # Check ground and ceiling collision
        if self.bird_pos_y <= 0.5 or self.bird_pos_y >= 8.5:
            self.handle_collision()
            return
            
        # Check pipe collision
        for pipe in self.pipes:
            if 0.5 <= pipe["x"] <= 3.5:  # Bird collision zone
                gap_start = pipe["gap_y"] - 1.5
                gap_end = pipe["gap_y"] + 1.5
                if not (gap_start <= self.bird_pos_y <= gap_end):
                    self.handle_collision()
                    return

    def restart(self):
        """Restart the game"""
        self.enter_preview_mode()  # Start in preview mode
        self.last_update_time = time.time()

    def get_state(self):
        """Get current game state"""
        self.highscore = self.read_highscore()  # Perbarui highscore dari file
        return {
            "bird_pos_y": float(self.bird_pos_y),
            "pipes": self.pipes if not self.preview_mode_active else [],
            "score": self.score,
            "highscore": self.highscore,
            "pipe_count": self.pipe_count,
            "game_over": self.game_mode == "game_over",
            "game_mode": self.game_mode,
            "preview_mode": self.preview_mode_active,
            "show_restart_dialog": self.show_restart_dialog,
            "pipe_speed": self.pipe_speed,
            "auto_restart_countdown": self.get_restart_countdown()
        }
    
    def get_restart_countdown(self):
        """Get countdown time for auto restart"""
        if (self.show_restart_dialog and self.restart_dialog_start_time):
            elapsed = time.time() - self.restart_dialog_start_time
            remaining = max(0, self.auto_restart_delay - elapsed)
            return int(remaining) + 1
        return 0