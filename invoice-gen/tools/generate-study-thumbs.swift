// Run from invoice-gen: swift tools/generate-study-thumbs.swift
// Small JPEG previews for the halftone fields and the risograph shader.
import AppKit
import Foundation

let width = 201, height = 320
let names = ["original", "alternate-1", "alternate-2"]
func color(_ hex: String) -> CGColor {
    let n = Int(hex.dropFirst(), radix: 16)!
    return CGColor(srgbRed: CGFloat((n >> 16) & 255) / 255,
                   green: CGFloat((n >> 8) & 255) / 255,
                   blue: CGFloat(n & 255) / 255, alpha: 1)
}
func bitmap(_ w: Int = width, _ h: Int = height) -> NSBitmapImageRep {
    NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h,
                     bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
                     isPlanar: false, colorSpaceName: .deviceRGB,
                     bytesPerRow: 0, bitsPerPixel: 0)!
}
func save(_ rep: NSBitmapImageRep, _ id: String, _ variant: Int) {
    try! rep.representation(using: .jpeg, properties: [.compressionFactor: 0.84])!
        .write(to: URL(fileURLWithPath: "thumbs/\(id)-\(names[variant]).jpg"))
}
func clamp(_ x: Double, _ lo: Double = 0, _ hi: Double = 1) -> Double { max(lo, min(hi, x)) }
struct V { var x: Double; var y: Double
    static func + (a: V, b: V) -> V { V(x:a.x+b.x,y:a.y+b.y) }
    static func * (a: V, b: Double) -> V { V(x:a.x*b,y:a.y*b) }
}
struct RNG {
    var a: UInt32 = 617
    mutating func next() -> Double {
        a = a &+ 0x6d2b79f5
        var t = a
        t = (t ^ (t >> 15)) &* (t | 1)
        t ^= t &+ ((t ^ (t >> 7)) &* (t | 61))
        return Double(t ^ (t >> 14)) / 4294967296
    }
}
let anchorSets: [[V]] = [
    [V(x:0.22,y:0.16),V(x:0.70,y:0.18),V(x:0.46,y:0.40),V(x:0.83,y:0.47),V(x:0.17,y:0.64),V(x:0.65,y:0.73),V(x:0.39,y:0.94)],
    [V(x:0.32,y:0.13),V(x:0.82,y:0.24),V(x:0.19,y:0.39),V(x:0.60,y:0.42),V(x:0.85,y:0.68),V(x:0.38,y:0.72),V(x:0.13,y:0.90)],
    [V(x:0.13,y:0.21),V(x:0.52,y:0.16),V(x:0.86,y:0.36),V(x:0.36,y:0.48),V(x:0.71,y:0.59),V(x:0.19,y:0.78),V(x:0.65,y:0.91)]
]
let blobPalettes = [("#ffffff","#3450ff","#ff1688"),("#ffec00","#951aff","#ff481f"),("#b8ffdb","#092d42","#ff3d71")]
for variant in 0..<3 {
    let rep=bitmap(), graphics=NSGraphicsContext(bitmapImageRep:rep)!
    NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=graphics
    let c=graphics.cgContext
    c.translateBy(x:0,y:CGFloat(height));c.scaleBy(x:CGFloat(width)/1000,y:-CGFloat(width)/1000)
    let W=1000.0,H=Double(height)*W/Double(width),m=min(W,H)
    let palette=blobPalettes[variant], primary=color(palette.1), secondary=color(palette.2)
    c.setFillColor(color(palette.0));c.fill(CGRect(x:0,y:0,width:W,height:H))
    let zoom=[1.06,1.08,1.10][variant], t=[4.8,7.2,10.1][variant]
    var rng=RNG()
    var balls:[(Double,Double,Double)]=[]
    for (i,a) in anchorSets[variant].enumerated() {
        let r=m*(0.105+rng.next()*0.045)*(i==2 ? 1.15 : 1)
        let fx=0.05+rng.next()*0.08, fy=0.05+rng.next()*0.08
        let px=rng.next()*2*Double.pi,py=rng.next()*2*Double.pi
        let x=W*(0.5+(a.x-0.5)*zoom+0.025*zoom*sin(t*2*Double.pi*fx+px))
        let y=H*(0.5+(a.y-0.5)*zoom+0.025*zoom*sin(t*2*Double.pi*fy+py))
        balls.append((x,y,pow(r*zoom,2)))
    }
    let spacing=19.0, cols=Int(ceil(W/spacing))+1,rows=Int(ceil(H/spacing))+1
    let ox=(W-Double(cols-1)*spacing)/2,oy=(H-Double(rows-1)*spacing)/2
    for j in 0..<rows { for i in 0..<cols {
        let x=ox+Double(i)*spacing,y=oy+Double(j)*spacing
        var f=0.0
        for b in balls { f += b.2/(pow(x-b.0,2)+pow(y-b.1,2)+1) }
        let k=clamp((f-0.65)/0.49),eased=k*k*(3-2*k)
        let r=(0.055+0.945*eased)*spacing*0.56
        if r<0.3 {continue}
        c.setFillColor(eased>0.5 ? primary : secondary)
        c.fillEllipse(in:CGRect(x:x-r,y:y-r,width:2*r,height:2*r))
    }}
    graphics.flushGraphics();NSGraphicsContext.restoreGraphicsState()
    save(rep,"blob",variant)
}

// Scalar port of the still shader: the same plates, halftone screen, ink order,
// paper fiber, roll variation and film grain as artwork-study-shader.js.
func fract(_ x: Double) -> Double { x-floor(x) }
func smoothstep(_ a: Double,_ b: Double,_ x: Double) -> Double {
    let t=clamp((x-a)/(b-a));return t*t*(3-2*t)
}
func mix(_ a:Double,_ b:Double,_ t:Double)->Double {a+(b-a)*t}
func hash(_ p:V)->Double {
    var x=fract(p.x*0.1031),y=fract(p.y*0.1031),z=fract(p.x*0.1031)
    let d=x*(y+33.33)+y*(z+33.33)+z*(x+33.33)
    x+=d;y+=d;z+=d
    return fract((x+y)*z)
}
func noise(_ p:V)->Double {
    let ix=floor(p.x),iy=floor(p.y)
    let x=smoothstep(0,1,fract(p.x)),y=smoothstep(0,1,fract(p.y))
    return mix(mix(hash(V(x:ix,y:iy)),hash(V(x:ix+1,y:iy)),x),
               mix(hash(V(x:ix,y:iy+1)),hash(V(x:ix+1,y:iy+1)),x),y)
}
func fbm(_ start:V,_ oct:Int=3)->Double {
    var p=start,a=0.5,sum=0.0,total=0.0
    for _ in 0..<oct {
        sum += a*noise(p);total += a
        p=V(x:(0.80*p.x-0.60*p.y)*2.03,y:(0.60*p.x+0.80*p.y)*2.03)
        a *= 0.5
    }
    return sum/total
}
func plateA(_ p:V)->Double {
    let disc=smoothstep(0.004,-0.004,hypot(p.x+0.12,p.y-0.05)-0.285)
    let arc=smoothstep(0.004,-0.004,abs(hypot(p.x-0.19,p.y+0.11)-0.255)-0.052)
    let bar=smoothstep(0.004,-0.004,max(abs(p.x-0.02)-0.33,abs(p.y+0.335)-0.022))
    return clamp(max(disc*0.92,arc*0.80,bar*0.86))
}
func plateB(_ p:V)->Double {
    let disc=smoothstep(0.004,-0.004,hypot(p.x-0.13,p.y+0.01)-0.245)
    let stripe=(fract(p.y*8.5+0.25)>=0.52 ? 1.0 : 0.0)
        * smoothstep(0.004,-0.004,abs(p.x+0.14)-0.30)
        * smoothstep(0.004,-0.004,abs(p.y-0.02)-0.285)
    let ring=smoothstep(0.004,-0.004,abs(hypot(p.x+0.26,p.y+0.19)-0.105)-0.015)
    return clamp(max(disc*0.86,stripe*0.55,ring*0.9))
}
func dots(_ frag:V,_ coverage:Double,_ angle:Double,_ size:Double)->Double {
    let co=cos(angle),si=sin(angle)
    let q=V(x:(co*frag.x+si*frag.y)/size,y:(-si*frag.x+co*frag.y)/size)
    let distance=hypot(fract(q.x)-0.5,fract(q.y)-0.5)
    let r=sqrt(clamp(coverage))*0.63
    return smoothstep(r+0.10,r-0.10,distance)
}
let inkSets:[[[Double]]] = [
    [[0.953,0.937,0.902],[1,0.282,0.690],[0,0.471,0.749]],
    [[0.949,1,0.671],[1,0.4,0.2],[0.392,0.141,0.91]],
    [[0.075,0.090,0.204],[0.98,0.98,0.96],[1,0.32,0.63]]
]
let shifts=[V(x:0.035,y:-0.035),V(x:0.043,y:-0.028),V(x:0.027,y:-0.043)]
let pans=[V(x:0.12,y:-0.09),V(x:0.16,y:0.14),V(x:-0.08,y:0.05)]
for variant in 0..<3 {
    let rw=628,rh=1000
    let rep=bitmap(rw,rh),time=[6.4,6.7,7.0][variant]
    let aspect=Double(rw)/Double(rh)
    let cameraHeight=min(0.74,0.94/aspect)/1.08,cameraWidth=cameraHeight*aspect
    let camera=V(x:shifts[variant].x-pans[variant].x*cameraWidth,
                 y:shifts[variant].y+pans[variant].y*cameraHeight)
    let stock=inkSets[variant][0],pink=inkSets[variant][1],blue=inkSets[variant][2]
    let off=mix(0,0.020,0.42)*(1+0.28*sin(time*0.21))
    let oA=V(x:off,y:-off*0.55),oB=V(x:-off*0.78,y:off*0.42)
    let size=10.5*max(Double(rh)/900,0.62)
    let bytes=rep.bitmapData!,stride=rep.bytesPerRow
    for j in 0..<rh { for i in 0..<rw {
        let uv=V(x:(Double(i)+0.5)/Double(rw),y:1-(Double(j)+0.5)/Double(rh))
        let frag=V(x:Double(i)+0.5,y:Double(rh-j)-0.5)
        let p=V(x:(uv.x-0.5)*cameraWidth+camera.x,y:(uv.y-0.5)*cameraHeight+camera.y)
        let rollA=0.80+0.30*fbm(V(x:uv.x*3.2,y:uv.y*44+time*0.05))
        let rollB=0.80+0.30*fbm(V(x:uv.x*2.7+9.1,y:uv.y*38-time*0.04))
        let density=mix(0.45,1.15,0.62)
        let covA=plateA(p+oA)*rollA*density,covB=plateB(p+oB)*rollB*density
        let dA=dots(frag,clamp(covA),0.262,size)
        let dB=dots(frag,clamp(covB),1.309,size*1.06)
        let fiberX=fbm(V(x:uv.x*1.1*340,y:uv.y*1.1*12),3)
        let fiberY=fbm(V(x:uv.x*1.1*11,y:uv.y*1.1*300),3)
        let fiber=(fiberX*0.5+fiberY*0.5-0.5)*0.035
        let grainA=hash(frag+V(x:fract(time*0.731)*97.13,y:fract(time*0.731)*53.77))
        let grainB=hash(frag*0.5+V(x:fract(time*0.517)*31.7,y:fract(time*0.517)*11.3))
        let grain=(grainA*0.68+grainB*0.32-0.5)*0.028
        let luminance=0.97+0.05*fbm(uv*1.4+V(x:7.7,y:7.7))
        let radius=hypot((uv.x-0.5)*1.06,uv.y-0.5)
        let vignette=1-0.16*smoothstep(0.22,0.98,radius)
        let index=j*stride+i*4
        for channel in 0..<3 {
            var value=stock[channel]
            value=mix(value,variant==2 ? blue[channel] : value*blue[channel]*1.05,dB*0.90)
            value=mix(value,variant==2 ? pink[channel] : value*pink[channel]*1.05,dA*0.90)
            value=((value+fiber)*luminance+grain)*vignette
            bytes[index+channel]=UInt8((clamp(value)*255).rounded())
        }
        bytes[index+3]=255
    }}
    let preview=bitmap(),graphics=NSGraphicsContext(bitmapImageRep:preview)!
    let image=NSImage(size:NSSize(width:rw,height:rh));image.addRepresentation(rep)
    NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=graphics
    graphics.imageInterpolation = .high
    image.draw(in:NSRect(x:0,y:0,width:width,height:height),from:.zero,operation:.copy,fraction:1)
    graphics.flushGraphics();NSGraphicsContext.restoreGraphicsState()
    save(preview,"riso",variant)
}
