import os
from PIL import Image, ImageDraw, ImageFont

def get_font(size, font_pref=["/System/Library/Fonts/Helvetica.ttc", "/System/Library/Fonts/Supplemental/Arial.ttf"]):
    for fp in font_pref:
        if os.path.exists(fp):
            try:
                return ImageFont.truetype(fp, size)
            except Exception:
                pass
    return ImageFont.load_default()

def create_clinical_image(filename, width, height, title, subtitle="", is_doctor=False):
    # Forest Green background: #0f3424
    bg_color = (15, 52, 36)
    # Gold accent: #d4af37
    gold_color = (212, 175, 55)
    # White: #ffffff
    white_color = (255, 255, 255)
    
    img = Image.new("RGB", (width, height), bg_color)
    draw = ImageDraw.Draw(img)
    
    # 1. Draw elegant gold border
    draw.rectangle([(5, 5), (width - 6, height - 6)], outline=gold_color, width=3)
    
    # 2. Draw subtle clinical grid / background pattern
    # Let's draw soft decorative diagonal corner lines
    draw.line([(5, 25), (25, 5)], fill=gold_color, width=1)
    draw.line([(width - 26, 5), (width - 6, 25)], fill=gold_color, width=1)
    draw.line([(5, height - 26), (25, height - 6)], fill=gold_color, width=1)
    draw.line([(width - 26, height - 6), (width - 6, height - 26)], fill=gold_color, width=1)

    # 3. Add text
    if is_doctor:
        # Doctor Profile Spec
        font_title = get_font(28)
        font_subtitle = get_font(18)
        font_body = get_font(14)
        
        draw.text((width // 2, 80), "DE NATURA AESTHETICS", fill=gold_color, anchor="mm", font=font_subtitle)
        draw.line([(40, 105), (width - 40, 105)], fill=gold_color, width=2)
        
        # Doctor name
        draw.text((width // 2, 220), "DR. ANAGHA S NATH", fill=white_color, anchor="mm", font=font_title)
        draw.text((width // 2, 260), "MDS — Oral & Maxillofacial Surgeon", fill=gold_color, anchor="mm", font=font_subtitle)
        
        # Subtext credentials
        draw.text((width // 2, 350), "• Clinical Cosmetologist", fill=white_color, anchor="mm", font=font_body)
        draw.text((width // 2, 380), "• Hair Transplant Surgery Specialist", fill=white_color, anchor="mm", font=font_body)
        draw.text((width // 2, 410), "• Facial Aesthetics Expert", fill=white_color, anchor="mm", font=font_body)
        draw.text((width // 2, 440), "• Trichology Consultant", fill=white_color, anchor="mm", font=font_body)
        
        draw.line([(80, 480), (width - 80, 480)], fill=gold_color, width=1)
        draw.text((width // 2, 510), "CLINICAL PROFILE IMAGE", fill=gold_color, anchor="mm", font=get_font(12))
    else:
        # Standard Case Study Visualizer
        font_title = get_font(24)
        font_subtitle = get_font(16)
        font_brand = get_font(12)
        
        # Brand Header
        draw.text((width // 2, 40), "DE NATURA AESTHETICS", fill=gold_color, anchor="mm", font=font_brand)
        draw.text((width // 2, 60), "CLINICAL CASE STUDY PORTFOLIO", fill=white_color, anchor="mm", font=get_font(10))
        draw.line([(30, 80), (width - 30, 80)], fill=gold_color, width=1)
        
        # Central clinical symbol (elegant gold cross outline)
        cx, cy = width // 2, height // 2 - 10
        draw.rectangle([(cx - 10, cy - 30), (cx + 10, cy + 30)], fill=None, outline=gold_color, width=1)
        draw.rectangle([(cx - 30, cy - 10), (cx + 30, cy + 10)], fill=None, outline=gold_color, width=1)
        
        # Case description titles
        draw.text((width // 2, height - 120), title, fill=white_color, anchor="mm", font=font_title)
        if subtitle:
            draw.text((width // 2, height - 70), subtitle, fill=gold_color, anchor="mm", font=font_subtitle)
            
        draw.text((width // 2, height - 30), "VERIFIED CLINICAL RESULTS", fill=gold_color, anchor="mm", font=get_font(10))
        
    img.save(filename, "JPEG", quality=95)
    print(f"Generated {filename}")

def main():
    # 1. Doctor Profile
    create_clinical_image("IMG_7017.JPG", 460, 570, "Dr. Anagha S Nath", is_doctor=True)
    
    # 2. Case Study 1
    create_clinical_image("case1_pre.jpg", 600, 450, "CASE STUDY 1", "Pre-Op State")
    create_clinical_image("case1_top.jpg", 600, 450, "CASE STUDY 1", "Top View blueprint")
    create_clinical_image("case1_post.jpg", 600, 450, "CASE STUDY 1", "Immediate Post-Op")
    create_clinical_image("case1_1m.jpg", 600, 450, "CASE STUDY 1", "1 Month Progress")
    create_clinical_image("case1_3m.jpg", 600, 450, "CASE STUDY 1", "3 Months Progress")
    create_clinical_image("case1_6m.jpg", 600, 450, "CASE STUDY 1", "6 Months Final Result")
    
    # 3. Case Study 2
    create_clinical_image("case2_1.jpg", 600, 450, "CASE STUDY 2", "Pre-Op Baseline")
    create_clinical_image("case2_2.jpg", 600, 450, "CASE STUDY 2", "Top-down Pre-Op")
    create_clinical_image("case2_3.jpg", 600, 450, "CASE STUDY 2", "Post Procedure Angle A")
    create_clinical_image("case2_4.jpg", 600, 450, "CASE STUDY 2", "Post Procedure Angle B")
    create_clinical_image("case2_5.jpg", 600, 450, "CASE STUDY 2", "Post Procedure Angle C")
    create_clinical_image("case2_6.jpg", 600, 450, "CASE STUDY 2", "1 Month Density Gains")
    create_clinical_image("case2_7.jpg", 600, 450, "CASE STUDY 2", "3 Months Density Gains")
    create_clinical_image("case2_8.jpg", 600, 450, "CASE STUDY 2", "6 Months Density Gains")
    
    # 4. Case Study 3
    create_clinical_image("edited-image-pre.jpg", 600, 600, "CASE STUDY 3", "Recessional State")
    create_clinical_image("edited-image-post.jpg", 600, 600, "CASE STUDY 3", "Square-Grid Integration")
    
    # 5. Case Study 4
    create_clinical_image("c4_1.jpg", 600, 450, "CASE STUDY 4", "Pre-Op Baseline")
    create_clinical_image("c4_2.jpg", 600, 450, "CASE STUDY 4", "Surgical Planning Drawing")
    create_clinical_image("c4_3.jpg", 600, 450, "CASE STUDY 4", "Immediate Post-Op")
    create_clinical_image("c4_4.jpg", 600, 450, "CASE STUDY 4", "1-2 Month Early Post")
    create_clinical_image("c4_5.jpg", 600, 450, "CASE STUDY 4", "Final Result Front View")
    create_clinical_image("c4_6.jpg", 600, 450, "CASE STUDY 4", "Final Result Top View")
    
    # 6. Case Study 5
    create_clinical_image("gfc_before.jpg", 600, 450, "CASE STUDY 5", "GFC Before (Thinning)")
    create_clinical_image("gfc_after.jpg", 600, 450, "CASE STUDY 5", "GFC After (Volume)")
    
    # 7. Case Study 6
    create_clinical_image("b1.jpg", 600, 450, "CASE STUDY 6", "Beard Pre-Op")
    create_clinical_image("b2.jpg", 600, 450, "CASE STUDY 6", "Beard After Procedure")
    create_clinical_image("b3.jpg", 600, 450, "CASE STUDY 6", "Beard 1 Week Progress")
    create_clinical_image("b4.jpg", 600, 450, "CASE STUDY 6", "Beard Clot Removal")
    create_clinical_image("b5.jpg", 600, 450, "CASE STUDY 6", "Beard 3 Months Progress")
    create_clinical_image("b6.jpg", 600, 450, "CASE STUDY 6", "Beard 6 Months Progress")

if __name__ == "__main__":
    main()
