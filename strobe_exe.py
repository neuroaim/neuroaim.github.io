import tkinter as tk
from tkinter import ttk
import threading
import time
import random
import ctypes
from ctypes import windll
import keyboard  # Requires: pip install keyboard

# --- Windows API Constants for Click-through ---
GWL_EXSTYLE = -20
WS_EX_LAYERED = 0x80000
WS_EX_TRANSPARENT = 0x20
WS_EX_TOPMOST = 0x8

class StrobeApp:
    def __init__(self, root):
        self.root = root
        self.root.title("NeuroStrobe - FPS Vision Trainer")
        self.root.geometry("400x380")
        self.root.resizable(False, False)
        
        # Dark theme UI setup
        self.style = ttk.Style()
        self.style.theme_use('clam')
        self.root.configure(bg='#2b2b2b')
        self.style.configure("TLabel", background='#2b2b2b', foreground='white')
        self.style.configure("TButton", background='#444', foreground='white')
        self.style.configure("TScale", background='#2b2b2b')

        # Variables
        self.running = False
        self.overlay_window = None
        
        # UI Elements
        self.create_ui()
        
        # Global Hotkey Setup (F9)
        # We use root.after to ensure thread safety when calling Tkinter functions from the keyboard thread
        try:
            keyboard.add_hotkey('f9', lambda: self.root.after(0, self.toggle_strobe))
        except Exception as e:
            print(f"Hotkey Error: {e}")

    def create_ui(self):
        # Header
        ttk.Label(self.root, text="NeuroStrobe Trainer", font=("Arial", 14, "bold")).pack(pady=10)
        
        # Instructions
        instr_frame = tk.Frame(self.root, bg='#2b2b2b')
        instr_frame.pack(pady=5)
        ttk.Label(instr_frame, text="Global Hotkey: Press [ F9 ] to Start/Stop", foreground='#00ff00').pack()

        # Frequency Lower Limit
        ttk.Label(self.root, text="Min Frequency (Hz) [Slow]:").pack(pady=(10, 2))
        self.freq_min_var = tk.DoubleVar(value=2.0)
        self.lbl_freq_min = ttk.Label(self.root, text="2.0 Hz")
        self.lbl_freq_min.pack()
        scale_min = ttk.Scale(self.root, from_=0.5, to=15.0, variable=self.freq_min_var, command=self.update_labels)
        scale_min.pack(fill='x', padx=20)

        # Frequency Upper Limit
        ttk.Label(self.root, text="Max Frequency (Hz) [Fast]:").pack(pady=2)
        self.freq_max_var = tk.DoubleVar(value=5.0)
        self.lbl_freq_max = ttk.Label(self.root, text="5.0 Hz")
        self.lbl_freq_max.pack()
        scale_max = ttk.Scale(self.root, from_=0.5, to=15.0, variable=self.freq_max_var, command=self.update_labels)
        scale_max.pack(fill='x', padx=20)

        # Duty Cycle
        ttk.Label(self.root, text="Visibility Duty Cycle (% Visible):").pack(pady=2)
        self.duty_var = tk.DoubleVar(value=0.6) 
        self.lbl_duty = ttk.Label(self.root, text="60%")
        self.lbl_duty.pack()
        scale_duty = ttk.Scale(self.root, from_=0.1, to=0.9, variable=self.duty_var, command=self.update_labels)
        scale_duty.pack(fill='x', padx=20)

        # Start Button
        self.btn_start = ttk.Button(self.root, text="START (F9)", command=self.toggle_strobe)
        self.btn_start.pack(pady=20, ipadx=10, ipady=5)
        
        # Status
        self.status_var = tk.StringVar(value="Status: IDLE")
        ttk.Label(self.root, textvariable=self.status_var, font=("Arial", 8)).pack(side='bottom', pady=5)

    def update_labels(self, event=None):
        if self.freq_min_var.get() > self.freq_max_var.get():
            self.freq_max_var.set(self.freq_min_var.get())
            
        self.lbl_freq_min.config(text=f"{self.freq_min_var.get():.1f} Hz")
        self.lbl_freq_max.config(text=f"{self.freq_max_var.get():.1f} Hz")
        self.lbl_duty.config(text=f"{int(self.duty_var.get() * 100)}%")

    def make_click_through(self, hwnd):
        try:
            style = windll.user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
            windll.user32.SetWindowLongW(hwnd, GWL_EXSTYLE, style | WS_EX_LAYERED | WS_EX_TRANSPARENT)
        except Exception as e:
            print(f"Error setting style: {e}")

    def toggle_strobe(self):
        if self.running:
            self.stop_strobe()
        else:
            self.start_strobe()

    def start_strobe(self):
        if self.running: return 
        self.running = True
        self.btn_start.config(text="STOP (F9)")
        self.status_var.set("Status: RUNNING")
        
        # Create Overlay
        self.overlay_window = tk.Toplevel(self.root)
        self.overlay_window.title("NeuroOverlay")
        self.overlay_window.overrideredirect(True)
        
        w = self.root.winfo_screenwidth()
        h = self.root.winfo_screenheight()
        self.overlay_window.geometry(f"{w}x{h}+0+0")
        self.overlay_window.configure(bg='black')
        self.overlay_window.wm_attributes("-topmost", True)
        self.overlay_window.wm_attributes("-alpha", 0.0)
        
        # Force update to get window handle
        self.root.update()
        hwnd = windll.user32.GetParent(self.overlay_window.winfo_id())
        self.make_click_through(hwnd)

        # Start thread
        self.thread = threading.Thread(target=self.strobe_loop)
        self.thread.daemon = True
        self.thread.start()

    def stop_strobe(self):
        self.running = False
        self.btn_start.config(text="START (F9)")
        self.status_var.set("Status: IDLE")
        if self.overlay_window:
            self.overlay_window.destroy()
            self.overlay_window = None

    def strobe_loop(self):
        while self.running and self.overlay_window:
            try:
                f_min = self.freq_min_var.get()
                f_max = self.freq_max_var.get()
                current_freq = random.uniform(f_min, f_max)
                cycle_time = 1.0 / current_freq
                
                duty = self.duty_var.get()
                time_visible = cycle_time * duty
                time_black = cycle_time * (1 - duty)
                
                # Visible Phase
                self.root.after(0, lambda: self.set_alpha(0.0))
                time.sleep(time_visible)
                
                if not self.running: break

                # Black Phase
                self.root.after(0, lambda: self.set_alpha(1.0))
                time.sleep(time_black)
                
            except RuntimeError:
                break 

    def set_alpha(self, alpha):
        if self.overlay_window and self.running:
            try:
                self.overlay_window.wm_attributes("-alpha", alpha)
            except tk.TclError:
                pass

if __name__ == "__main__":
    root = tk.Tk()
    app = StrobeApp(root)
    # Ensure keyboard hook is removed on exit to prevent errors
    def on_closing():
        keyboard.unhook_all()
        root.destroy()
    root.protocol("WM_DELETE_WINDOW", on_closing)
    root.mainloop()