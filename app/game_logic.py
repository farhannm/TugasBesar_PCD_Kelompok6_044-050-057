import random
import os
import time

class Game:
    def __init__(self):
        self.score = 0
        self.highscore = self.read_highscore()
        self.bird_pos_y = 5  # Posisi awal burung (tengah grid)
        self.pipes = [{"x": 15, "gap_y": random.randint(2, 7)}]  # Pipa awal
        self.game_over = False
        self.last_pipe_time = time.time()
        self.last_update_time = time.time()

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

    def update(self, bird_pos_y):
        if self.game_over:
            return
            
        self.bird_pos_y = bird_pos_y
        current_time = time.time()
        
        # Check boundaries
        if self.bird_pos_y < 0 or self.bird_pos_y > 9:
            self.game_over = True
            return

        # Update pipe positions every 0.1 seconds for smoother movement
        if current_time - self.last_update_time > 0.1:
            for pipe in self.pipes:
                pipe["x"] -= 0.5  # Slower movement for web version
            
            # Remove pipes that are off screen
            self.pipes = [p for p in self.pipes if p["x"] >= -2]
            
            # Add new pipe when needed
            if not any(p["x"] > 12 for p in self.pipes):
                self.pipes.append({"x": 20, "gap_y": random.randint(2, 7)})
            
            self.last_update_time = current_time

        # Check scoring - when bird passes through pipe
        for pipe in self.pipes:
            if 1.5 <= pipe["x"] <= 2.5:  # Bird is at x=2, check range for scoring
                gap_start = pipe["gap_y"] - 1
                gap_end = pipe["gap_y"] + 1
                if gap_start <= self.bird_pos_y <= gap_end:
                    # Only score once per pipe
                    if not hasattr(pipe, 'scored'):
                        self.score += 10
                        pipe['scored'] = True
                        self.save_highscore()

        # Check collision
        for pipe in self.pipes:
            if 1.5 <= pipe["x"] <= 2.5:  # Bird collision zone
                gap_start = pipe["gap_y"] - 1
                gap_end = pipe["gap_y"] + 1
                if not (gap_start <= self.bird_pos_y <= gap_end):
                    self.game_over = True

    def restart(self):
        self.score = 0
        self.bird_pos_y = 5
        self.pipes = [{"x": 15, "gap_y": random.randint(2, 7)}]
        self.game_over = False
        self.last_pipe_time = time.time()
        self.last_update_time = time.time()

    def get_state(self):
        return {
            "bird_pos_y": self.bird_pos_y,
            "pipes": self.pipes,
            "score": self.score,
            "highscore": self.highscore,
            "game_over": self.game_over
        }